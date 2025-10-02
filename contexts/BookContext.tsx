import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { DeviceEventEmitter } from 'react-native';
import { Book } from '../services/database';
import { db } from '../services/database.factory';
import { useUser } from './UserContext';
import { triggerAutoSync } from '@/utils/autoSync';

interface BookContextType {
  books: Book[];
  activeBook: Book | null;
  isLoading: boolean;
  createBook: (name: string) => Promise<void>;
  setActiveBook: (book: Book) => void;
  updateBook: (bookId: number, name: string) => Promise<void>;
  deleteBook: (bookId: number) => Promise<void>;
  refreshBooks: () => Promise<void>;
}

const BookContext = createContext<BookContextType | undefined>(undefined);

interface BookProviderProps {
  children: ReactNode;
}

export const BookProvider: React.FC<BookProviderProps> = ({ children }) => {
  const { user, isLoading: userLoading } = useUser();
  const [books, setBooks] = useState<Book[]>([]);
  const [activeBook, setActiveBookState] = useState<Book | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const refreshBooks = async () => {
    // Wait for user context to finish loading before querying database
    if (!user || userLoading) return;
    
    setIsLoading(true);
    try {
      const userBooks = await db.listBooks(user.id);
      setBooks(userBooks);
      
      // Try to restore previously selected book
      if (userBooks.length > 0) {
        const savedBookId = await db.getSelectedBookId(user.id);
        const savedBook = savedBookId ? userBooks.find(book => book.id === savedBookId) : null;
        
        if (savedBook) {
          setActiveBookState(savedBook);
        } else if (!activeBook) {
          // If no saved book or saved book doesn't exist, use first book
          setActiveBookState(userBooks[0]);
        }
      }
    } catch (error) {
      console.error('Error refreshing books:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const createBook = async (name: string) => {
    if (!user || userLoading) return;
    
    setIsLoading(true);
    try {
      const newBook = await db.createBook(user.id, name);
      setBooks(prev => [newBook, ...prev]);
      
      // Set as active book and save to database
      setActiveBookState(newBook);
      await db.setSelectedBookId(user.id, newBook.id);
      
      // Trigger dirty count update
      DeviceEventEmitter.emit('dirtyCountUpdate');
      
      // Trigger auto-sync if enabled
      await triggerAutoSync(user.id);
    } catch (error) {
      console.error('Error creating book:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const setActiveBook = async (book: Book) => {
    setActiveBookState(book);
    
    // Save the selected book to database
    if (user) {
      try {
        await db.setSelectedBookId(user.id, book.id);
      } catch (error) {
        console.error('Error saving selected book:', error);
      }
    }
  };

  const deleteBook = async (bookId: number) => {
    if (!user || userLoading) return;
    setIsLoading(true);
    try {
      await db.deleteBook(user.id, bookId);
      setBooks(prev => prev.filter(book => book.id !== bookId));
      
      // Trigger dirty count update
      DeviceEventEmitter.emit('dirtyCountUpdate');
      
      // Update active book if needed
      if (activeBook?.id === bookId) {
        const remainingBooks = books.filter(book => book.id !== bookId);
        setActiveBookState(remainingBooks.length > 0 ? remainingBooks[0] : null);
      }
      
      // Trigger auto-sync if enabled
      await triggerAutoSync(user.id);
    } catch (error) {
      console.error('Error deleting book:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateBook = async (bookId: number, name: string) => {
    if (!user || userLoading) return;
    
    setIsLoading(true);
    try {
      const updatedBook = await db.updateBook(user.id, bookId, name);
      setBooks(prev => prev.map(book => book.id === bookId ? updatedBook : book));
      
      // If this is the active book, update it
      if (activeBook?.id === bookId) {
        setActiveBookState(updatedBook);
      }
      
      // Trigger dirty count update
      DeviceEventEmitter.emit('dirtyCountUpdate');
      
      // Trigger auto-sync if enabled
      await triggerAutoSync(user.id);
    } catch (error) {
      console.error('Error updating book:', error);
    } finally {
      setIsLoading(false);
    }
  };
  useEffect(() => {
    if (user && !userLoading) {
      refreshBooks();
    } else if (!user) {
      setBooks([]);
      setActiveBookState(null);
    }
  }, [user, userLoading]);

  // Listen for sync updates
  useEffect(() => {
    const handleBooksUpdated = () => {
      console.log('[BOOK-CONTEXT] Received booksUpdated event, refreshing...');
      refreshBooks();
    };

    const subscription = DeviceEventEmitter.addListener('booksUpdated', handleBooksUpdated);
    
    return () => {
      subscription.remove();
    };
  }, [user, userLoading]);

  const value: BookContextType = {
    books,
    activeBook,
    isLoading,
    createBook,
    setActiveBook,
    updateBook,
    deleteBook,
    refreshBooks,
  };

  return (
    <BookContext.Provider value={value}>
      {children}
    </BookContext.Provider>
  );
};

export const useBooks = (): BookContextType => {
  const context = useContext(BookContext);
  if (context === undefined) {
    throw new Error('useBooks must be used within a BookProvider');
  }
  return context;
};
