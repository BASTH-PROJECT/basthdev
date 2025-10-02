import DrawerNavigator from '@/components/DrawerNavigator';
import { BookProvider } from '@/contexts/BookContext';
import { DrawerProvider } from '@/contexts/DrawerContext';
import { TransactionProvider } from '@/contexts/TransactionContext';
import { UserProvider } from '@/contexts/UserContext';
import { SupabaseProvider } from '@/contexts/SupabaseContext';
import { SyncProvider } from '@/contexts/SyncContext';

export default function Layout() {
  // console.log('🏠 Home Layout rendered');

  return (
    <UserProvider>
      <SupabaseProvider>
        <SyncProvider>
          <DrawerProvider>
            <BookProvider>
              <TransactionProvider>
                <DrawerNavigator />
              </TransactionProvider>
            </BookProvider>
          </DrawerProvider>
        </SyncProvider>
      </SupabaseProvider>
    </UserProvider>
  );
}