/**
 * Export Utilities (Sprint 11.2)
 * PDF and Excel export functionality
 */

import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';

/**
 * Generate PDF from data
 * @param {Array} data - Array of objects to export
 * @param {Object} options - Export options
 * @returns {Promise<Buffer>} PDF buffer
 */
export async function generatePDF(data, options = {}) {
  const {
    title = 'Export Report',
    fields = null, // If null, export all fields
    filename = 'export.pdf',
  } = options;

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const buffers = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });
      doc.on('error', reject);

      // Title
      doc.fontSize(20).text(title, { align: 'center' });
      doc.moveDown();

      // Date
      doc
        .fontSize(10)
        .fillColor('#666666')
        .text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
      doc.moveDown(2);

      // Table header
      if (data.length > 0) {
        const allFields = fields || Object.keys(data[0]);

        // Calculate column widths
        const pageWidth = doc.page.width - 100; // Margins
        const colWidth = pageWidth / allFields.length;

        // Header row
        doc.fontSize(10).fillColor('#000000').font('Helvetica-Bold');
        let x = 50;
        allFields.forEach((field, index) => {
          const label = formatFieldLabel(field);
          doc.text(label, x, doc.y, { width: colWidth, align: 'left' });
          x += colWidth;
        });
        doc.moveDown();

        // Data rows
        doc.font('Helvetica').fontSize(9).fillColor('#000000');
        data.forEach((row, rowIndex) => {
          // Check if we need a new page
          if (doc.y > doc.page.height - 100) {
            doc.addPage();
            // Redraw header on new page
            doc.fontSize(10).fillColor('#000000').font('Helvetica-Bold');
            x = 50;
            allFields.forEach(field => {
              const label = formatFieldLabel(field);
              doc.text(label, x, doc.y, { width: colWidth, align: 'left' });
              x += colWidth;
            });
            doc.moveDown();
            doc.font('Helvetica').fontSize(9);
          }

          x = 50;
          allFields.forEach(field => {
            const value = formatFieldValue(row[field]);
            doc.text(String(value || ''), x, doc.y, { width: colWidth, align: 'left' });
            x += colWidth;
          });
          doc.moveDown();

          // Add separator line
          if (rowIndex < data.length - 1) {
            doc
              .moveTo(50, doc.y)
              .lineTo(pageWidth + 50, doc.y)
              .strokeColor('#cccccc')
              .lineWidth(0.5)
              .stroke();
            doc.moveDown(0.5);
          }
        });
      } else {
        doc.text('No data to export', { align: 'center' });
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Generate Excel from data
 * @param {Array} data - Array of objects to export
 * @param {Object} options - Export options
 * @returns {Promise<Buffer>} Excel buffer
 */
export async function generateExcel(data, options = {}) {
  const {
    title = 'Export Report',
    fields = null, // If null, export all fields
    sheetName = 'Sheet1',
  } = options;

  try {
    // Create workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(sheetName);

    // Prepare fields
    const allFields = fields || (data.length > 0 ? Object.keys(data[0]) : []);

    // Add header row
    if (allFields.length > 0) {
      const headerRow = allFields.map(field => formatFieldLabel(field));
      worksheet.addRow(headerRow);

      // Style header row
      const headerRowObj = worksheet.getRow(1);
      headerRowObj.font = { bold: true };
      headerRowObj.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
      };
    }

    // Add data rows
    if (data.length > 0) {
      data.forEach(row => {
        const rowData = allFields.map(field => formatFieldValue(row[field]));
        worksheet.addRow(rowData);
      });
    }

    // Auto-size columns
    worksheet.columns = allFields.map(field => {
      let maxLength = formatFieldLabel(field).length;
      if (data.length > 0) {
        data.forEach(row => {
          const value = String(formatFieldValue(row[field]) || '');
          if (value.length > maxLength) maxLength = value.length;
        });
      }
      return { width: Math.min(maxLength + 2, 50) }; // Cap at 50 characters
    });

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  } catch (error) {
    throw new Error(`Failed to generate Excel: ${error.message}`);
  }
}

/**
 * Format field label for display
 */
function formatFieldLabel(field) {
  return field
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Format field value for display
 */
function formatFieldValue(value) {
  if (value === null || value === undefined) {
    return '';
  }

  if (value instanceof Date) {
    return value.toLocaleDateString();
  }

  if (typeof value === 'object') {
    // Handle nested objects (e.g., vmp_companies.name)
    if (value.name) return value.name;
    if (value.id) return value.id;
    return JSON.stringify(value);
  }

  return String(value);
}

/**
 * Get available export fields for a list type
 */
export function getExportFields(listType) {
  const fieldMaps = {
    cases: [
      { key: 'id', label: 'Case ID', default: true },
      { key: 'case_num', label: 'Case Number', default: true },
      { key: 'subject', label: 'Subject', default: true },
      { key: 'status', label: 'Status', default: true },
      { key: 'case_type', label: 'Case Type', default: true },
      { key: 'created_at', label: 'Created Date', default: false },
      { key: 'updated_at', label: 'Updated Date', default: false },
      { key: 'sla_due_at', label: 'SLA Due Date', default: false },
      { key: 'vmp_companies.name', label: 'Company', default: true },
      { key: 'escalation_level', label: 'Escalation Level', default: false },
    ],
    invoices: [
      { key: 'id', label: 'Invoice ID', default: true },
      { key: 'invoice_num', label: 'Invoice Number', default: true },
      { key: 'invoice_date', label: 'Invoice Date', default: true },
      { key: 'amount', label: 'Amount', default: true },
      { key: 'currency_code', label: 'Currency', default: true },
      { key: 'status', label: 'Status', default: true },
      { key: 'vmp_companies.name', label: 'Company', default: true },
      { key: 'created_at', label: 'Created Date', default: false },
      { key: 'due_date', label: 'Due Date', default: false },
    ],
    payments: [
      { key: 'id', label: 'Payment ID', default: true },
      { key: 'payment_ref', label: 'Payment Reference', default: true },
      { key: 'payment_date', label: 'Payment Date', default: true },
      { key: 'amount', label: 'Amount', default: true },
      { key: 'currency_code', label: 'Currency', default: true },
      { key: 'vmp_companies.name', label: 'Company', default: true },
      { key: 'vmp_invoices.invoice_num', label: 'Invoice Number', default: true },
      { key: 'remittance_url', label: 'Has Remittance', default: false },
      { key: 'source_system', label: 'Source System', default: false },
    ],
  };

  return fieldMaps[listType] || [];
}
