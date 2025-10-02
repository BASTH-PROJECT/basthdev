// Use legacy API to access cache/document directories and content URIs across SDKs
import * as FileSystem from "expo-file-system/legacy";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";
import * as XLSX from "xlsx";

// Primary brand color from app theme
const PRIMARY_COLOR = "#10b981";
const PRIMARY_DARK = "#059669";
const INCOME_COLOR = "#34d399";
const EXPENSE_COLOR = "#f87171";

export interface ExportTransaction {
  id: number;
  type: "income" | "expense";
  amount: number;
  category?: string | null;
  note?: string | null;
  created_at: string;
}

export interface ExportOptions {
  monthLabel: string;
  startDate: Date;
  endDate: Date;
  bookName?: string | null;
}

const INDONESIAN_FORMATTER = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

function buildBaseFileName(options: ExportOptions) {
  // Use format: oniCashApp_YYYY-MM
  const y = options.startDate.getFullYear();
  const m = String(options.startDate.getMonth() + 1).padStart(2, "0");
  const dateSegment = `${y}-${m}`;
  return `oniCashApp_${dateSegment}`;
}

// Safely obtain a writable directory (cache preferred, then document)
function getCacheDirectory() {
  // @ts-ignore - expo-file-system exports these but types may not reflect it
  const cache = FileSystem.cacheDirectory;
  // @ts-ignore
  const doc = FileSystem.documentDirectory;
  
  console.log('getCacheDirectory - cache:', cache);
  console.log('getCacheDirectory - doc:', doc);
  
  return cache ?? doc ?? null;
}

/**
 * 📊 Export to Excel (.xlsx) with enhanced formatting
 */
async function exportToExcel(
  transactions: ExportTransaction[],
  options: ExportOptions,
  settings?: { saveToDevice?: boolean }
) {
  try {
    // Calculate summary
    const summary = transactions.reduce(
      (acc, tx) => {
        if (tx.type === "income") {
          acc.income += tx.amount;
          acc.balance += tx.amount;
        } else {
          acc.expense += tx.amount;
          acc.balance -= tx.amount;
        }
        return acc;
      },
      { income: 0, expense: 0, balance: 0 }
    );

    // Prepare data rows (array of arrays) to control ordering & layout
    const dataRows = transactions.map((tx) => [
      new Date(tx.created_at).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      new Date(tx.created_at).toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      tx.type === "income" ? "Pemasukan" : "Pengeluaran",
      tx.category ?? "Tanpa Kategori",
      tx.note ?? "-",
      tx.amount,
    ]);

    // Build AOA to mimic PDF layout
    const headerTitle = [`Laporan Transaksi - ${options.monthLabel}`];
    const headerBook = [`Buku: ${options.bookName ?? "Semua Buku"}`];
    const headerPeriod = [
      `Periode: ${options.startDate.toLocaleDateString("id-ID")} - ${options.endDate.toLocaleDateString("id-ID")}`,
    ];
    const summaryRow = [
      "Saldo",
      INDONESIAN_FORMATTER.format(summary.balance),
      "Pemasukan",
      INDONESIAN_FORMATTER.format(summary.income),
      "Pengeluaran",
      INDONESIAN_FORMATTER.format(summary.expense),
    ];
    const tableHeader = ["Tanggal", "Waktu", "Tipe", "Kategori", "Catatan", "Jumlah"];

    const aoa: any[][] = [
      headerTitle,
      headerBook,
      headerPeriod,
      [],
      summaryRow,
      [],
      tableHeader,
      ...dataRows,
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(aoa);

    // Merge title rows across A-F
    worksheet["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }, // A1:F1
      { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } }, // A2:F2
      { s: { r: 2, c: 0 }, e: { r: 2, c: 5 } }, // A3:F3
    ];

    // Set column widths
    worksheet["!cols"] = [
      { wch: 15 }, // Tanggal
      { wch: 10 }, // Waktu
      { wch: 15 }, // Tipe
      { wch: 22 }, // Kategori
      { wch: 36 }, // Catatan
      { wch: 18 }, // Jumlah
    ];

    // Auto-filter on data range
    const headerRowIndex = 7; // 1-based Excel row for the header row in our AOA
    const dataStartRow = headerRowIndex + 1;
    const dataEndRow = headerRowIndex + dataRows.length;
    if (dataRows.length > 0) {
      worksheet["!autofilter"] = { ref: `A${headerRowIndex}:F${dataEndRow}` } as any;
    }

    // Number format for Jumlah column (F) for all data rows
    for (let i = 0; i < dataRows.length; i++) {
      const excelRow = dataStartRow + i; // 1-based row index
      const cellAddr = `F${excelRow}`;
      const cell = worksheet[cellAddr];
      if (cell) {
        // Set number format to thousands without decimals
        (cell as any).t = 'n';
        (cell as any).z = '#,##0';
      }
    }

    // Create workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Transaksi");

    // Build descriptive filename: oniCashApp_{BookName}_{YYYY}_{month}.xlsx
    const year = options.startDate.getFullYear();
    const monthName = options.startDate.toLocaleDateString('id-ID', { month: 'long' }).toLowerCase();
    const rawBook = options.bookName ?? 'SemuaBuku';
    const safeBook = rawBook.replace(/\s+/g, '_') // spaces -> underscores
                            .replace(/[^\p{L}\p{N}_-]/gu, ''); // keep letters/numbers/underscore/hyphen
    const fileName = `oniCashApp_${safeBook}_${year}_${monthName}.xlsx`;

    // Generate Excel file as base64
    const wbout = XLSX.write(workbook, { type: "base64", bookType: "xlsx" });
    
    // Use a temporary file approach similar to PDF
    // Create a temporary HTML file that triggers download
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8"></head>
        <body>
          <script>
            const base64 = "${wbout}";
            const binary = atob(base64);
            const array = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
              array[i] = binary.charCodeAt(i);
            }
            const blob = new Blob([array], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = '${fileName}';
            a.click();
          </script>
        </body>
      </html>
    `;

    // Use Print to create a temporary file, then we'll replace it
    const { uri: tempUri } = await Print.printToFileAsync({ html: htmlContent });
    
    // Get directory from the temp file
    const dir = tempUri.substring(0, tempUri.lastIndexOf('/') + 1);
    const fileUri = `${dir}${fileName}`;
    
    console.log('Excel - tempUri:', tempUri);
    console.log('Excel - dir:', dir);
    console.log('Excel - fileUri:', fileUri);
    
    // Write the Excel file
    // @ts-ignore - expo-file-system exports this but types may not reflect it
    await FileSystem.writeAsStringAsync(fileUri, wbout, {
      encoding: "base64",
    });

    // Save to device via SAF if requested
    if (settings?.saveToDevice) {
      try {
        // @ts-ignore - StorageAccessFramework is available on legacy import
        const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (!permissions.granted) {
          throw new Error("EXPORT_SAVE_CANCELLED");
        }
        // @ts-ignore
        const safFileUri = await FileSystem.StorageAccessFramework.createFileAsync(
          permissions.directoryUri,
          fileName,
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        // @ts-ignore
        await FileSystem.StorageAccessFramework.writeAsStringAsync(safFileUri, wbout, {
          encoding: FileSystem.EncodingType.Base64,
        });
        return safFileUri;
      } catch (e) {
        console.warn("Excel - SAF save failed", e);
        throw e;
      }
    }

    // Otherwise share the file
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, {
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        dialogTitle: `Ekspor ${fileName}`,
        UTI: Platform.OS === "ios" ? "com.microsoft.excel.xlsx" : undefined,
      });
    } else {
      throw new Error("EXPORT_SHARE_UNAVAILABLE");
    }

    return fileUri;
  } catch (error) {
    console.error("Excel export error:", error);
    throw error;
  }
}

/**
 * 📑 Export to PDF with beautiful styling using primary color
 */
async function exportToPdf(
  transactions: ExportTransaction[],
  options: ExportOptions,
  settings?: { saveToDevice?: boolean }
) {
  try {
    // Calculate summary
    const summary = transactions.reduce(
      (acc, tx) => {
        if (tx.type === "income") {
          acc.income += tx.amount;
          acc.balance += tx.amount;
        } else {
          acc.expense += tx.amount;
          acc.balance -= tx.amount;
        }
        return acc;
      },
      { income: 0, expense: 0, balance: 0 }
    );

    // Generate table rows with alternating colors
    const tableRows = transactions
      .map((tx, index) => {
        const date = new Date(tx.created_at).toLocaleDateString("id-ID", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
        const time = new Date(tx.created_at).toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
        });
        const type = tx.type === "income" ? "Pemasukan" : "Pengeluaran";
        const typeColor = tx.type === "income" ? INCOME_COLOR : EXPENSE_COLOR;
        const category = tx.category ?? "Tanpa Kategori";
        const note = tx.note ?? "-";
        const amount = INDONESIAN_FORMATTER.format(tx.amount);
        const rowBg = index % 2 === 0 ? "#ffffff" : "#f9fafb";

        return `<tr style="background-color: ${rowBg};">
          <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb;">${date}<br/><span style="font-size: 10px; color: #6b7280;">${time}</span></td>
          <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb;">
            <span style="display: inline-block; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; background-color: ${typeColor}20; color: ${typeColor};">
              ${type}
            </span>
          </td>
          <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb;">${category}</td>
          <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 11px;">${note}</td>
          <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600; color: ${typeColor};">${amount}</td>
        </tr>`;
      })
      .join("");

    const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            padding: 32px 24px;
            color: #111827;
            background: #ffffff;
          }
          
          .header {
            background: linear-gradient(135deg, ${PRIMARY_COLOR} 0%, ${PRIMARY_DARK} 100%);
            padding: 24px;
            border-radius: 12px;
            margin-bottom: 24px;
            color: white;
          }
          
          .header h1 {
            font-size: 24px;
            font-weight: 700;
            margin-bottom: 8px;
          }
          
          .header .book-name {
            font-size: 14px;
            opacity: 0.9;
            margin-bottom: 4px;
          }
          
          .header .period {
            font-size: 13px;
            opacity: 0.85;
          }
          
          .summary {
            display: flex;
            gap: 16px;
            margin-bottom: 24px;
            flex-wrap: wrap;
          }
          
          .summary-card {
            flex: 1;
            min-width: 150px;
            padding: 16px;
            border-radius: 10px;
            border: 2px solid #e5e7eb;
            background: #f9fafb;
          }
          
          .summary-card.balance {
            border-color: ${PRIMARY_COLOR};
            background: ${PRIMARY_COLOR}10;
          }
          
          .summary-card.income {
            border-color: ${INCOME_COLOR};
            background: ${INCOME_COLOR}10;
          }
          
          .summary-card.expense {
            border-color: ${EXPENSE_COLOR};
            background: ${EXPENSE_COLOR}10;
          }
          
          .summary-label {
            font-size: 12px;
            font-weight: 600;
            color: #6b7280;
            margin-bottom: 6px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          
          .summary-value {
            font-size: 18px;
            font-weight: 700;
            color: #111827;
          }
          
          .summary-card.balance .summary-value {
            color: ${PRIMARY_COLOR};
          }
          
          .summary-card.income .summary-value {
            color: ${INCOME_COLOR};
          }
          
          .summary-card.expense .summary-value {
            color: ${EXPENSE_COLOR};
          }
          
          .table-container {
            overflow-x: auto;
            border-radius: 10px;
            border: 1px solid #e5e7eb;
          }
          
          table {
            width: 100%;
            border-collapse: collapse;
            background: white;
          }
          
          thead {
            background: ${PRIMARY_COLOR};
            color: white;
          }
          
          th {
            padding: 14px 8px;
            text-align: left;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          
          th:last-child {
            text-align: right;
          }
          
          tbody tr:last-child td {
            border-bottom: none;
          }
          
          .empty-state {
            text-align: center;
            padding: 48px 16px;
            color: #9ca3af;
            font-size: 14px;
          }
          
          .footer {
            margin-top: 32px;
            padding-top: 16px;
            border-top: 2px solid #e5e7eb;
            text-align: center;
            color: #6b7280;
            font-size: 11px;
          }
          
          .footer strong {
            color: ${PRIMARY_COLOR};
            font-weight: 600;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>📊 Laporan Transaksi</h1>
          <div class="book-name">Buku: ${options.bookName ?? "Semua Buku"}</div>
          <div class="period">Periode: ${options.startDate.toLocaleDateString("id-ID")} - ${options.endDate.toLocaleDateString("id-ID")}</div>
        </div>
        
        <div class="summary">
          <div class="summary-card balance">
            <div class="summary-label">Saldo</div>
            <div class="summary-value">${INDONESIAN_FORMATTER.format(summary.balance)}</div>
          </div>
          <div class="summary-card income">
            <div class="summary-label">Pemasukan</div>
            <div class="summary-value">${INDONESIAN_FORMATTER.format(summary.income)}</div>
          </div>
          <div class="summary-card expense">
            <div class="summary-label">Pengeluaran</div>
            <div class="summary-value">${INDONESIAN_FORMATTER.format(summary.expense)}</div>
          </div>
        </div>
        
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Tipe</th>
                <th>Kategori</th>
                <th>Catatan</th>
                <th style="text-align: right;">Jumlah</th>
              </tr>
            </thead>
            <tbody>
              ${
                tableRows ||
                '<tr><td colspan="5" class="empty-state">Tidak ada transaksi pada periode ini</td></tr>'
              }
            </tbody>
          </table>
        </div>
        
        <div class="footer">
          Dibuat dengan <strong>ONI CashApp</strong> • ${new Date().toLocaleDateString("id-ID", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </div>
      </body>
    </html>
  `;

    // Build descriptive filename: oniCashApp_{BookName}_{YYYY}_{month}.pdf
    const year = options.startDate.getFullYear();
    const monthName = options.startDate.toLocaleDateString('id-ID', { month: 'long' }).toLowerCase();
    const rawBook = options.bookName ?? 'SemuaBuku';
    const safeBook = rawBook.replace(/\s+/g, '_')
                            .replace(/[^\p{L}\p{N}_-]/gu, '');
    const fileName = `oniCashApp_${safeBook}_${year}_${monthName}.pdf`;

    // Generate PDF
    const { uri } = await Print.printToFileAsync({
      html,
      base64: false,
    });

    // Move temp file to a directory with our desired file name (both Android and iOS)
    // Prefer cache/document, otherwise fallback to the temp file's directory
    const preferredDir = getCacheDirectory() ?? uri.substring(0, uri.lastIndexOf('/') + 1);
    let targetUri = `${preferredDir}${fileName}`;
    try {
      // @ts-ignore - expo-file-system exports this but types may not reflect it
      await FileSystem.moveAsync({ from: uri, to: targetUri });
    } catch (e) {
      console.warn("Failed to move PDF to target filename, falling back to temp URI", e);
      targetUri = uri; // fallback
    }

    // Save to device via SAF if requested
    if (settings?.saveToDevice) {
      try {
        // Read PDF as base64
        // @ts-ignore
        const base64Pdf = await FileSystem.readAsStringAsync(targetUri, { encoding: FileSystem.EncodingType.Base64 });
        // @ts-ignore
        const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (!permissions.granted) {
          throw new Error("EXPORT_SAVE_CANCELLED");
        }
        // @ts-ignore
        const safFileUri = await FileSystem.StorageAccessFramework.createFileAsync(
          permissions.directoryUri,
          fileName,
          "application/pdf"
        );
        // @ts-ignore
        await FileSystem.StorageAccessFramework.writeAsStringAsync(safFileUri, base64Pdf, {
          encoding: FileSystem.EncodingType.Base64,
        });
        return safFileUri;
      } catch (e) {
        console.warn("PDF - SAF save failed", e);
        throw e;
      }
    }

    // Otherwise share the file
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(targetUri, {
        mimeType: "application/pdf",
        dialogTitle: `Ekspor ${fileName}`,
        UTI: Platform.OS === "ios" ? "com.adobe.pdf" : undefined,
      });
    } else {
      throw new Error("EXPORT_SHARE_UNAVAILABLE");
    }

    return targetUri;
  } catch (error) {
    console.error("PDF export error:", error);
    throw error;
  }
}

// Export functions with consistent naming
export const exportTransactionsToExcel = exportToExcel;
export const exportTransactionsToPdf = exportToPdf;

export default {
  exportToExcel,
  exportToPdf,
  exportTransactionsToExcel,
  exportTransactionsToPdf,
};
