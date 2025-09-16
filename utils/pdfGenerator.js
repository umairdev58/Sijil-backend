const PDFDocument = require('pdfkit');

class PDFGenerator {
  constructor() {
    this.doc = null;
    this.currentY = 0;
    this.pageWidth = 595;
    this.pageHeight = 842;
    this.margin = 40;
    this.contentWidth = this.pageWidth - (this.margin * 2);
  }

  // Initialize PDF document
  initDocument(res, filename, options = {}) {
    const {
      margin = this.margin,
      size = 'A4',
      layout = 'portrait',
    } = options;
    this.doc = new PDFDocument({
      margin,
      size,
      layout
    });

    // Set response headers (include CORS for blobs/downloads)
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    
    // Pipe the PDF to response
    this.doc.pipe(res);
    
    return this.doc;
  }

  // Generate single-invoice (A4 half size, landscape ~ 598x421pt) on pre-printed paper
  generateInvoiceA5(res, sale, options = {}) {
    const {
      companyTRN = process.env.COMPANY_TRN || '',
    } = options;

    // A5 landscape approximate size in points (21.08 cm x 14.85 cm)
    const width = 598; // ~21.08cm
    const height = 421; // ~14.85cm
    const margin = 10;

    const doc = this.initDocument(res, `invoice-${sale.invoiceNumber || 'invoice'}.pdf`, {
      margin,
      size: [width, height],
      layout: 'portrait'
    });

    // Set all text to black and bold for better readability
    this.doc.fillColor('#000000');
    this.doc.font('Helvetica-Bold');

    // Top-right details
    const rightX = width - 80;
    this.doc.fontSize(10);
    this.doc.text(new Date(sale.invoiceDate).toLocaleDateString('en-GB'), rightX, 75); // Date
    this.doc.text(sale.invoiceNumber || '', rightX, 92); // Inv. No.
    if (sale.referenceNo) {
      this.doc.text(sale.referenceNo, rightX, 104); // Ref. No. if any
    }

    // Customer name (left area)
    this.doc.fontSize(11).font('Helvetica-Bold');
    this.doc.text(sale.customer || '', 70, 75, { width: 260, continued: false });

    // TAX INVOICE title area center TRN (our own) only if VAT > 0
    const subtotal = (sale.quantity || 0) * (sale.rate || 0);
    const vatPct = Number(sale.vatPercentage || 0);
    const vatAmount = +(subtotal * vatPct / 100).toFixed(2);
    const amountInclVat = +(subtotal + vatAmount).toFixed(2);

    if (vatPct > 0) {
      // Customer TRN under customer
      if (sale.customerTRN) {
        this.doc.fontSize(10).font('Helvetica-Bold');
        this.doc.text(`TRN - ${sale.customerTRN}`, 70, 88, { width: 260 });
      }

      // Our TRN under TAX INVOICE heading (center area roughly)
      const centerX = width / 2 - 70;
      this.doc.fontSize(10).font('Helvetica-Bold');
      const ourTRN = companyTRN || '';
      if (ourTRN) {
        this.doc.text(`TRN - ${ourTRN}`, centerX, 110, { width: 140, align: 'center' });
      }
    }

    // Single line item row (only values, the grid is pre-printed)
    const rowY = 155;
    this.doc.fontSize(10).font('Helvetica-Bold');
    // Compute right-aligned columns within page width
    const gap = 8;
    const rightEdge =width - margin; // printable right edge
    const amountInclW = 70; const amountInclX = rightEdge - amountInclW;
    const vatAmtW = 40; const vatAmtX = amountInclX - gap - vatAmtW;
    const vatPctW = 40; const vatPctX = vatAmtX - gap - vatPctW;
    const amtW = 45; const amtX = vatPctX - gap - amtW;
    const unitW = 30; const unitX = amtX - gap - unitW;
    const qtyW = 30; const qtyX = unitX - gap - qtyW;
    const descX = 120; const descW = Math.max(100, qtyX - descX - 10);

    // Description (left aligned)
    const description = [sale.product, sale.marka].filter(Boolean).join(' - ');
    this.doc.text(description, descX, rowY, { width: descW });
    // Qty (right aligned)
    this.doc.text(String(sale.quantity || 0), qtyX, rowY, { width: qtyW, align: 'right' });
    // Unit Price
    this.doc.text((sale.rate || 0).toFixed(2), unitX, rowY, { width: unitW, align: 'right' });
    // Amount (subtotal)
    this.doc.text(subtotal.toFixed(2), amtX, rowY, { width: amtW, align: 'right' });
    // VAT%
    this.doc.text(`${vatPct || 0}%`, vatPctX, rowY, { width: vatPctW, align: 'right' });
    // VAT Amount
    this.doc.text(vatAmount.toFixed(2), vatAmtX, rowY, { width: vatAmtW, align: 'right' });
    // Amount incl VAT
    this.doc.text(amountInclVat.toFixed(2), amountInclX, rowY, { width: amountInclW, align: 'right' });

    // Totals (bottom-right box on pre-printed form)
    const totalsX = width - 160;
    const totalsStartY = 295;
    const roundOf = +(Math.round(amountInclVat) - amountInclVat).toFixed(2);
    const totalRounded = +(amountInclVat + roundOf).toFixed(2);

    this.doc.font('Helvetica-Bold');
    this.doc.text(subtotal.toFixed(2), totalsX, totalsStartY, { width: 140, align: 'right' }); // Amount
    this.doc.text(vatAmount.toFixed(2), totalsX, totalsStartY + 18, { width: 140, align: 'right' }); // VAT Amount
    this.doc.text((roundOf >= 0 ? roundOf : -Math.abs(roundOf)).toFixed(2), totalsX, totalsStartY + 40, { width: 140, align: 'right' }); // Round Of
    this.doc.text(totalRounded.toFixed(2), totalsX, totalsStartY + 57, { width: 140, align: 'right' }); // Total (Inc. VAT)

    doc.end();
  }

  // Add company header
  addHeader(companyName = 'KOTIA FRUITS AND VEGETABLES TRADING LLC') {
    this.doc.fillColor('#1a365d');
    this.doc.fontSize(24).font('Helvetica-Bold');
    this.doc.text(companyName, { align: 'center' });
    
    this.doc.moveDown(1);
    this.doc.fontSize(14).font('Helvetica');
    this.doc.fillColor('#4a5568');
    this.doc.text('SALES REPORT', { align: 'center' });
    
    this.doc.moveDown(2); // Increased spacing after header
    this.currentY = this.doc.y;
  }

  // Add filter information
  addFilters(filters) {
    if (!filters || Object.keys(filters).length === 0) return;

    this.doc.fontSize(12).font('Helvetica-Bold');
    this.doc.fillColor('#2d3748');
    this.doc.text('Report Filters:', this.margin, this.currentY);
    this.doc.moveDown(0.5);

    this.doc.fontSize(10).font('Helvetica');
    this.doc.fillColor('#4a5568');
    
    let filterText = '';
    if (filters.startDate && filters.endDate) {
      filterText += `Date Range: ${new Date(filters.startDate).toLocaleDateString()} - ${new Date(filters.endDate).toLocaleDateString()}`;
    }
    if (filters.customer) {
      filterText += filterText ? ' | ' : '';
      filterText += `Customer: ${filters.customer}`;
    }
    if (filters.supplier) {
      filterText += filterText ? ' | ' : '';
      filterText += `Supplier: ${filters.supplier}`;
    }
    if (filters.status) {
      filterText += filterText ? ' | ' : '';
      filterText += `Status: ${filters.status}`;
    }

    if (filterText) {
      this.doc.text(filterText);
      this.doc.moveDown(2); // Increased spacing after filters
    }
    
    this.currentY = this.doc.y;
  }

  // Add summary section with enhanced styling
  addSummary(summary) {
    this.doc.fontSize(16).font('Helvetica-Bold');
    this.doc.fillColor('#2d3748');
    this.doc.text('SUMMARY', this.margin, this.currentY);
    this.doc.moveDown(2); // Increased spacing after summary heading

    // Create summary boxes
    const boxWidth = (this.contentWidth - 30) / 4;
    const boxHeight = 60;
    const startX = this.margin;
    const startY = this.currentY + 10;

    // Total Sales Box
    this.drawSummaryBox(startX, startY, boxWidth, boxHeight, '#4299e1', 'Total Sales', summary.totalSales.toString(), '#2b6cb0');

    // Total Amount Box
    this.drawSummaryBox(startX + boxWidth + 10, startY, boxWidth, boxHeight, '#48bb78', 'Total Amount', `AED ${summary.totalAmount.toLocaleString()}`, '#2f855a');

    // Total Received Box
    this.drawSummaryBox(startX + (boxWidth + 10) * 2, startY, boxWidth, boxHeight, '#ed8936', 'Total Received', `AED ${summary.totalReceived.toLocaleString()}`, '#c05621');

    // Outstanding Box
    this.drawSummaryBox(startX + (boxWidth + 10) * 3, startY, boxWidth, boxHeight, '#f56565', 'Outstanding', `AED ${summary.totalOutstanding.toLocaleString()}`, '#c53030');

    this.currentY = startY + boxHeight + 60; // Increased spacing after summary boxes
    this.doc.y = this.currentY;
  }

  // Draw individual summary box
  drawSummaryBox(x, y, width, height, bgColor, title, value, textColor) {
    // Background
    this.doc.fillColor(bgColor);
    this.doc.rect(x, y, width, height).fill();
    
    // Border
    this.doc.strokeColor('#e2e8f0');
    this.doc.lineWidth(1);
    this.doc.rect(x, y, width, height).stroke();
    
    // Title
    this.doc.fillColor('white');
    this.doc.fontSize(8).font('Helvetica-Bold');
    this.doc.text(title, x + 5, y + 5, { width: width - 10 });
    
    // Value
    this.doc.fontSize(12).font('Helvetica-Bold');
    this.doc.text(value, x + 5, y + 25, { width: width - 10, align: 'center' });
    
    // Reset colors
    this.doc.fillColor('black');
    this.doc.strokeColor('black');
  }

  // Add status breakdown
  addStatusBreakdown(statusBreakdown) {
    if (!statusBreakdown || Object.keys(statusBreakdown).length === 0) return;

    this.doc.fontSize(14).font('Helvetica-Bold');
    this.doc.fillColor('#2d3748');
    this.doc.text('Status Breakdown', this.margin, this.currentY);
    this.doc.moveDown(1); // Increased spacing after heading

    const totalSales = Object.values(statusBreakdown).reduce((sum, count) => sum + count, 0);
    const startX = this.margin;
    const startY = this.currentY + 10;

    Object.entries(statusBreakdown).forEach(([status, count], index) => {
      const percentage = ((count / totalSales) * 100).toFixed(1);
      const y = startY + (index * 25);
      
      // Status label
      this.doc.fontSize(10).font('Helvetica-Bold');
      this.doc.fillColor(this.getStatusColor(status));
      this.doc.text(status.replace('_', ' ').toUpperCase(), startX, y);
      
      // Count and percentage
      this.doc.fontSize(10).font('Helvetica');
      this.doc.fillColor('#4a5568');
      this.doc.text(`${count} sales (${percentage}%)`, startX + 150, y);
      
      // Progress bar
      const barWidth = 200;
      const barHeight = 8;
      const progressWidth = (count / totalSales) * barWidth;
      
      this.doc.fillColor('#e2e8f0');
      this.doc.rect(startX + 250, y + 2, barWidth, barHeight).fill();
      this.doc.fillColor(this.getStatusColor(status));
      this.doc.rect(startX + 250, y + 2, progressWidth, barHeight).fill();
    });

    this.currentY = startY + (Object.keys(statusBreakdown).length * 25) + 30; // Increased spacing
    this.doc.y = this.currentY;
  }

  // Get color for status
  getStatusColor(status) {
    switch (status) {
      case 'paid': return '#48bb78';
      case 'partially_paid': return '#ed8936';
      case 'unpaid': return '#4299e1';
      case 'overdue': return '#f56565';
      default: return '#718096';
    }
  }

  // Sanitize printable fields to avoid 'N/A' and internal/system values
  sanitizeField(value) {
    if (value === null || value === undefined) return '';
    const stringValue = String(value).trim();
    if (!stringValue) return '';
    const lower = stringValue.toLowerCase();
    if (lower === 'n/a') return '';
    if (lower === 'system administrator' || lower === 'system admin' || lower === 'admin') return '';
    return stringValue;
  }

  // Enhanced sanitize field for received by specifically
  sanitizeReceivedBy(value) {
    if (value === null || value === undefined) return '';
    const stringValue = String(value).trim();
    if (!stringValue) return '';
    const lower = stringValue.toLowerCase();
    if (lower === 'n/a') return '';
    if (lower === 'system administrator' || lower === 'system admin' || lower === 'admin') return '';
    return stringValue;
  }

  // Add sales table with improved formatting
  addSalesTable(sales, includePayments = false, paymentsBySale = {}) {
    this.doc.fontSize(14).font('Helvetica-Bold');
    this.doc.fillColor('#2d3748');
    this.doc.text('SALES DETAILS', this.margin, this.currentY);
    this.doc.moveDown(3); // Increased spacing after heading

    // Table headers
    const headers = ['Date', 'Invoice #', 'Customer', 'Container', 'Product', 'Amount', 'Status'];
    const columnWidths = [60, 70, 100, 70, 100, 70, 65];
    const totalWidth = columnWidths.reduce((a, b) => a + b, 0);

    this.drawTableHeader(headers, columnWidths, this.currentY + 10);
    this.currentY += 35;

         // Table rows
     sales.forEach((sale, index) => {
       // Check if we need a new page - improved logic to prevent splitting rows
       const rowHeight = 38; // Increased row height by 1.5x (25 * 1.5 = 37.5, rounded to 38)
       const paymentHeight = includePayments && paymentsBySale[sale._id.toString()] ? 
         (20 /* header */) + (paymentsBySale[sale._id.toString()].length * 18) : 0;
       const totalRowHeight = rowHeight + paymentHeight + (paymentHeight ? 15 /* separator */ + 10 /* spacing */ : 0);
       
       if (this.currentY + totalRowHeight > this.pageHeight - 100) {
         this.addNewPage();
         this.drawTableHeader(headers, columnWidths, this.currentY);
         this.currentY += 40; // Increased header spacing
       }

       this.drawSalesRow(sale, columnWidths, this.currentY, index);
       this.currentY += rowHeight;

       // Add payment details if requested
       if (includePayments && paymentsBySale[sale._id.toString()]) {
         const salePayments = paymentsBySale[sale._id.toString()];
         const paymentsStartY = this.currentY;
         this.addPaymentDetails(salePayments, columnWidths, paymentsStartY);
         // Move Y by header (20) + rows (n*18) + separator (5 drawn inside) + extra spacing (10)
         this.currentY += 20 + (salePayments.length * 18) + 10 + 5;
       }
     });

    this.currentY += 30; // Additional spacing after sales table
    this.doc.y = this.currentY;
  }

  // Draw table header
  drawTableHeader(headers, columnWidths, y) {
    this.doc.fillColor('#2c3e50');
    this.doc.rect(this.margin, y, columnWidths.reduce((a, b) => a + b, 0), 25).fill();
    this.doc.fillColor('white');
    this.doc.fontSize(9).font('Helvetica-Bold');
    
    let x = this.margin;
    headers.forEach((header, i) => {
      this.doc.text(header, x + 5, y + 8);
      x += columnWidths[i];
    });
    this.doc.fillColor('black');
  }

     // Draw sales row with improved formatting
   drawSalesRow(sale, columnWidths, y, index) {
     // Always white background for invoice rows
     this.doc.fillColor('white');
     this.doc.rect(this.margin, y, columnWidths.reduce((a, b) => a + b, 0), 38).fill(); // Increased height to match rowHeight
     this.doc.fillColor('black');
     
     let x = this.margin;
     this.doc.fontSize(9).font('Helvetica'); // Increased font size
     
     // Date
     const formattedDate = new Date(sale.invoiceDate).toLocaleDateString('en-GB');
     this.doc.text(formattedDate, x + 5, y + 12, { width: columnWidths[0] - 10 }); // Adjusted y offset for larger row
     x += columnWidths[0];
     
     // Invoice Number
     this.doc.font('Helvetica-Bold');
     this.doc.text(sale.invoiceNumber, x + 5, y + 12, { width: columnWidths[1] - 10 }); // Adjusted y offset
     x += columnWidths[1];
     
     // Customer
     this.doc.font('Helvetica');
     this.doc.text(sale.customer, x + 5, y + 12, { width: columnWidths[2] - 10, ellipsis: true }); // Adjusted y offset
     x += columnWidths[2];
     
     // Container
     this.doc.text(sale.containerNo, x + 5, y + 12, { width: columnWidths[3] - 10, ellipsis: true }); // Adjusted y offset
     x += columnWidths[3];
     
     // Product
     this.doc.text(sale.product, x + 5, y + 12, { width: columnWidths[4] - 10, ellipsis: true }); // Adjusted y offset
     x += columnWidths[4];
     
     // Amount
     this.doc.font('Helvetica-Bold');
     this.doc.text(`AED ${sale.amount.toLocaleString()}`, x + 5, y + 12, { width: columnWidths[5] - 10, align: 'right' }); // Adjusted y offset
     x += columnWidths[5];
     
     // Status with proper line break
     this.doc.fillColor(this.getStatusColor(sale.status));
     const statusText = sale.status.replace('_', ' ').toUpperCase();
     this.doc.text(statusText, x + 5, y + 12, { width: columnWidths[6] - 10 }); // Adjusted y offset
     this.doc.fillColor('black');
   }

     // Add payment details
   addPaymentDetails(payments, columnWidths, startY) {
     const tableWidth = columnWidths.reduce((a, b) => a + b, 0);

     // Thin separator line above the payment block label
     this.doc.strokeColor('#cbd5e0');
     this.doc.lineWidth(0.5);
     this.doc.moveTo(this.margin, startY - 5).lineTo(this.margin + tableWidth, startY - 5).stroke();

     // Draw subtle border around the entire payment block to delineate it
     const blockHeight = 20 + (payments.length * 18);
     this.doc.strokeColor('#cbd5e0');
     this.doc.lineWidth(0.75);
     this.doc.rect(this.margin, startY, tableWidth, blockHeight).stroke();

     // Header bar (grey) with bold label
     this.doc.fillColor('#e9ecef');
     this.doc.rect(this.margin, startY, tableWidth, 20).fill();
     this.doc.fillColor('#2d3748');
     this.doc.fontSize(9).font('Helvetica-Bold');
     this.doc.text('PAYMENT TRANSACTIONS:', this.margin + 8, startY + 6);
     this.doc.fillColor('black');
     
     // Nested appearance for payment rows
     const indentStartX = this.margin + 10; // indent content under invoice
     payments.forEach((payment, index) => {
       const y = startY + 20 + (index * 18);
       
       this.doc.fontSize(8).font('Helvetica');
       this.doc.fillColor('#f8f9fa'); // keep grey background for rows
       this.doc.rect(this.margin, y, tableWidth, 18).fill();
       this.doc.fillColor('black');
       
       let x = indentStartX;
       
       // Payment Date
       const paymentDate = new Date(payment.paymentDate).toLocaleDateString('en-GB');
       this.doc.text(paymentDate, x + 5, y + 5, { width: columnWidths[0] - 10 });
       x += columnWidths[0];
       
       // Payment Amount
       this.doc.fillColor('#28a745');
       this.doc.font('Helvetica-Bold');
       this.doc.text(`AED ${payment.amount.toLocaleString()}`, x + 5, y + 5, { width: columnWidths[1] - 10, align: 'right' });
       x += columnWidths[1];
       
       // Payment Method
       this.doc.fillColor('black');
       this.doc.font('Helvetica');
       this.doc.text(this.sanitizeField(payment.paymentMethod), x + 5, y + 5, { width: columnWidths[2] - 10 });
       x += columnWidths[2];
       
       // Payment Type
       this.doc.text(this.sanitizeField(payment.paymentType), x + 5, y + 5, { width: columnWidths[3] - 10 });
       x += columnWidths[3];
       
       // Reference
       this.doc.text(this.sanitizeField(payment.reference), x + 5, y + 5, { width: columnWidths[4] - 10 });
       x += columnWidths[4];
       
       // Notes
       this.doc.text(this.sanitizeField(payment.notes), x + 5, y + 5, { width: columnWidths[5] - 10 });
       x += columnWidths[5];
       
              // Received By (hide system accounts)
        const receivedBy = typeof payment.receivedBy === 'object' ? payment.receivedBy.name : payment.receivedBy;
        this.doc.text(this.sanitizeReceivedBy(receivedBy), x + 5, y + 5, { width: columnWidths[6] - 10 });
     });

     // Bottom separator line to clearly mark the end of the block
     const endY = startY + blockHeight + 5;
     this.doc.strokeColor('#a0aec0');
     this.doc.lineWidth(0.75);
     this.doc.moveTo(this.margin, endY).lineTo(this.margin + tableWidth, endY).stroke();

     // Reset stroke settings
     this.doc.strokeColor('black');
     this.doc.lineWidth(1);
   }

  // Add new page
  addNewPage() {
    this.doc.addPage();
    this.currentY = this.margin;
    this.doc.y = this.currentY;
  }

  // Add footer with improved formatting
  addFooter() {
    const footerY = this.pageHeight - 50;
    
    this.doc.fontSize(8).font('Helvetica');
    this.doc.fillColor('#718096');
    this.doc.text('KOTIA FRUITS AND VEGETABLES TRADING LLC - Sales Report', this.margin, footerY);
    this.doc.text(`Page ${this.doc.bufferedPageRange().count}`, this.pageWidth - this.margin - 50, footerY);
    
    // Format footer with single line generation info
    const generationInfo = `Generated on ${new Date().toLocaleDateString('en-GB')} at ${new Date().toLocaleTimeString('en-GB')}`;
    this.doc.text(generationInfo, { align: 'center' });
  }

  // Generate complete sales report
  generateSalesReport(res, data, filters = {}) {
    const doc = this.initDocument(res, `sales-report-${new Date().toISOString().split('T')[0]}.pdf`);
    
    // Add header
    this.addHeader();
    
    // Add filters
    this.addFilters(filters);
    
    // Add summary
    this.addSummary(data.summary);
    
    // Group payments by sale ID
    const paymentsBySale = {};
    if (data.payments && data.payments.length > 0) {
      data.payments.forEach(payment => {
        if (!paymentsBySale[payment.saleId]) {
          paymentsBySale[payment.saleId] = [];
        }
        paymentsBySale[payment.saleId].push(payment);
      });
    }
    
    // Add sales table
    this.addSalesTable(data.sales, data.payments && data.payments.length > 0, paymentsBySale);
    
    // Add footer
    this.addFooter();
    
    // Finalize the PDF
    doc.end();
  }

  // Generate purchase report
  generatePurchaseReport(res, data, filters = {}) {
    const doc = this.initDocument(res, `purchase-report-${new Date().toISOString().split('T')[0]}.pdf`);
    
    // Add header for purchase report
    this.addPurchaseHeader();
    
    // Add filters
    this.addFilters(filters);
    
    // Add purchase summary
    this.addPurchaseSummary(data.summary);
    
    // Add purchase table
    this.addPurchaseTable(data.purchases);
    
    // Add footer
    this.addFooter();
    
    // Finalize the PDF
    doc.end();
  }

  // Add purchase-specific header
  addPurchaseHeader(companyName = 'KOTIA FRUITS AND VEGETABLES TRADING LLC') {
    this.doc.fillColor('#1a365d');
    this.doc.fontSize(24).font('Helvetica-Bold');
    this.doc.text(companyName, { align: 'center' });
    
    this.doc.moveDown(1);
    this.doc.fontSize(14).font('Helvetica');
    this.doc.fillColor('#4a5568');
    this.doc.text('PURCHASE REPORT', { align: 'center' });
    
    this.doc.moveDown(2); // Increased spacing after header
    this.currentY = this.doc.y;
  }

  // Add purchase summary section
  addPurchaseSummary(summary) {
    this.doc.fontSize(16).font('Helvetica-Bold');
    this.doc.fillColor('#2d3748');
    this.doc.text('SUMMARY', this.margin, this.currentY);
    this.doc.moveDown(2); // Increased spacing after summary heading

    // Create summary boxes
    const boxWidth = (this.contentWidth - 30) / 4;
    const boxHeight = 60;
    const startX = this.margin;
    const startY = this.currentY + 10;

    // Total Purchases Box
    this.drawSummaryBox(startX, startY, boxWidth, boxHeight, '#4299e1', 'Total Purchases', summary.totalPurchases.toString(), '#2b6cb0');

    // Total PKR Box
    this.drawSummaryBox(startX + boxWidth + 10, startY, boxWidth, boxHeight, '#48bb78', 'Total PKR', `PKR ${summary.totalPKR.toLocaleString()}`, '#2f855a');

    // Total AED Box
    this.drawSummaryBox(startX + (boxWidth + 10) * 2, startY, boxWidth, boxHeight, '#ed8936', 'Total AED', `AED ${summary.totalAED.toLocaleString()}`, '#c05621');

    // Average Cost Box
    this.drawSummaryBox(startX + (boxWidth + 10) * 3, startY, boxWidth, boxHeight, '#f56565', 'Avg Cost/Purchase', `AED ${summary.averageCost.toLocaleString()}`, '#c53030');

    this.currentY = startY + boxHeight + 60; // Increased spacing after summary boxes
    this.doc.y = this.currentY;
  }

  // Add purchase table
  addPurchaseTable(purchases) {
    this.doc.fontSize(14).font('Helvetica-Bold');
    this.doc.fillColor('#2d3748');
    this.doc.text('PURCHASE DETAILS', this.margin, this.currentY);
    this.doc.moveDown(3); // Increased spacing after heading

    // Table headers for purchases
    const headers = ['Container', 'Product', 'Quantity', 'Rate (PKR)', 'Total PKR', 'Total AED', 'Created'];
    const columnWidths = [75, 110, 55, 75, 75, 75, 70]; // Total: 535
    const totalWidth = columnWidths.reduce((a, b) => a + b, 0);

    this.drawTableHeader(headers, columnWidths, this.currentY + 10);
    this.currentY += 35;

    // Table rows
    purchases.forEach((purchase, index) => {
      // Check if we need a new page - improved logic to prevent splitting rows
      const rowHeight = 30; // Increased row height by 1.5x (20 * 1.5 = 30)
      
      if (this.currentY + rowHeight > this.pageHeight - 100) {
        this.addNewPage();
        this.drawTableHeader(headers, columnWidths, this.currentY);
        this.currentY += 35;
      }

      this.drawPurchaseRow(purchase, columnWidths, this.currentY, index);
      this.currentY += rowHeight;
    });

    this.currentY += 30; // Additional spacing after purchase table
    this.doc.y = this.currentY;
  }

  // Draw purchase row
  drawPurchaseRow(purchase, columnWidths, y, index) {
    // Alternate row colors
    this.doc.fillColor(index % 2 === 0 ? '#f7fafc' : 'white');
    this.doc.rect(this.margin, y, columnWidths.reduce((a, b) => a + b, 0), 30).fill(); // Increased height to match rowHeight
    this.doc.fillColor('black');
    
    let x = this.margin;
    this.doc.fontSize(8).font('Helvetica');
    
    // Container Number
    this.doc.font('Helvetica-Bold');
    this.doc.text(purchase.containerNo, x + 5, y + 8, { width: columnWidths[0] - 10 }); // Adjusted y offset for larger row
    x += columnWidths[0];
    
    // Product
    this.doc.font('Helvetica');
    this.doc.text(purchase.product, x + 5, y + 8, { width: columnWidths[1] - 10, ellipsis: true }); // Adjusted y offset
    x += columnWidths[1];
    
    // Quantity
    this.doc.text(purchase.quantity.toString(), x + 5, y + 8, { width: columnWidths[2] - 10, align: 'center' }); // Adjusted y offset
    x += columnWidths[2];
    
    // Rate (PKR)
    this.doc.font('Helvetica-Bold');
    this.doc.text(`PKR ${purchase.rate.toLocaleString()}`, x + 5, y + 8, { width: columnWidths[3] - 10, align: 'right' }); // Adjusted y offset
    x += columnWidths[3];
    
    // Total PKR
    this.doc.text(`PKR ${purchase.totalPKR.toLocaleString()}`, x + 5, y + 8, { width: columnWidths[4] - 10, align: 'right' }); // Adjusted y offset
    x += columnWidths[4];
    
    // Total AED
    this.doc.text(`AED ${purchase.totalAED.toLocaleString()}`, x + 5, y + 8, { width: columnWidths[5] - 10, align: 'right' }); // Adjusted y offset
    x += columnWidths[5];
    
    // Created Date
    this.doc.font('Helvetica');
    const createdDate = new Date(purchase.createdAt).toLocaleDateString('en-GB');
    this.doc.text(createdDate, x + 5, y + 8, { width: columnWidths[6] - 10 }); // Adjusted y offset
  }

  // Add cost breakdown section
  addCostBreakdown(purchases) {
    this.doc.fontSize(14).font('Helvetica-Bold');
    this.doc.fillColor('#2d3748');
    this.doc.text('COST BREAKDOWN', this.margin, this.currentY);
    this.doc.moveDown(0.5);

    // Calculate cost breakdowns
    const totalTransport = purchases.reduce((sum, p) => sum + (p.transport || 0), 0);
    const totalFreight = purchases.reduce((sum, p) => sum + (p.freight || 0), 0);
    const totalEForm = purchases.reduce((sum, p) => sum + (p.eForm || 0), 0);
    const totalMisc = purchases.reduce((sum, p) => sum + (p.miscellaneous || 0), 0);

    const startX = this.margin;
    const startY = this.currentY + 10;

    // Transport Costs
    this.drawCostBreakdownBox(startX, startY, 120, 40, '#4299e1', 'Transport', `PKR ${totalTransport.toLocaleString()}`, '#2b6cb0');

    // Freight Costs
    this.drawCostBreakdownBox(startX + 130, startY, 120, 40, '#48bb78', 'Freight', `PKR ${totalFreight.toLocaleString()}`, '#2f855a');

    // E-Form Costs
    this.drawCostBreakdownBox(startX + 260, startY, 120, 40, '#ed8936', 'E-Form', `PKR ${totalEForm.toLocaleString()}`, '#c05621');

    // Miscellaneous Costs
    this.drawCostBreakdownBox(startX + 390, startY, 120, 40, '#f56565', 'Miscellaneous', `PKR ${totalMisc.toLocaleString()}`, '#c53030');

    this.currentY = startY + 50;
    this.doc.y = this.currentY;
  }

  // Draw cost breakdown box
  drawCostBreakdownBox(x, y, width, height, bgColor, title, value, textColor) {
    // Background
    this.doc.fillColor(bgColor);
    this.doc.rect(x, y, width, height).fill();
    
    // Border
    this.doc.strokeColor('#e2e8f0');
    this.doc.lineWidth(1);
    this.doc.rect(x, y, width, height).stroke();
    
    // Title
    this.doc.fillColor('white');
    this.doc.fontSize(8).font('Helvetica-Bold');
    this.doc.text(title, x + 5, y + 5, { width: width - 10 });
    
    // Value
    this.doc.fontSize(10).font('Helvetica-Bold');
    this.doc.text(value, x + 5, y + 20, { width: width - 10, align: 'center' });
    
    // Reset colors
    this.doc.fillColor('black');
    this.doc.strokeColor('black');
  }

  // Generate transport report
  generateTransportReport(res, transportInvoices, options = {}) {
    const doc = this.initDocument(res, `transport-report-${new Date().toISOString().split('T')[0]}.pdf`);
    
    // Header
    this.doc.fontSize(20).font('Helvetica-Bold');
    this.doc.fillColor('#2d3748');
    this.doc.text('TRANSPORT INVOICES REPORT', this.margin, 50, { align: 'center' });
    
    // Subtitle
    this.doc.fontSize(12).font('Helvetica');
    this.doc.fillColor('#4a5568');
    this.doc.text(`Generated on: ${new Date().toLocaleDateString('en-GB')}`, this.margin, 80, { align: 'center' });
    
    // Summary
    const totalInvoices = transportInvoices.length;
    const totalAmountPKR = transportInvoices.reduce((sum, invoice) => sum + (invoice.amount_pkr || 0), 0);
    const totalAmountAED = transportInvoices.reduce((sum, invoice) => sum + (invoice.amount_aed || 0), 0);
    const totalPaidPKR = transportInvoices.reduce((sum, invoice) => sum + (invoice.paid_amount_pkr || 0), 0);
    const totalOutstandingPKR = transportInvoices.reduce((sum, invoice) => sum + (invoice.outstanding_amount_pkr || 0), 0);
    
    // Summary boxes
    this.doc.fontSize(14).font('Helvetica-Bold');
    this.doc.fillColor('#2d3748');
    this.doc.text('Summary', this.margin, 120);
    
    const summaryY = 140;
    const boxWidth = 120;
    const boxHeight = 40;
    const spacing = 20;
    
    // Total Invoices
    this.doc.fillColor('#3b82f6').rect(this.margin, summaryY, boxWidth, boxHeight).fill();
    this.doc.fillColor('white').fontSize(10).font('Helvetica-Bold');
    this.doc.text('Total Invoices', this.margin + 5, summaryY + 5);
    this.doc.fontSize(12).text(totalInvoices.toString(), this.margin + 5, summaryY + 20);
    
    // Total Amount PKR
    this.doc.fillColor('#10b981').rect(this.margin + boxWidth + spacing, summaryY, boxWidth, boxHeight).fill();
    this.doc.fillColor('white').fontSize(10).font('Helvetica-Bold');
    this.doc.text('Total PKR', this.margin + boxWidth + spacing + 5, summaryY + 5);
    this.doc.fontSize(12).text(new Intl.NumberFormat('en-US', { style: 'currency', currency: 'PKR' }).format(totalAmountPKR), this.margin + boxWidth + spacing + 5, summaryY + 20);
    
    // Total Amount AED
    this.doc.fillColor('#f59e0b').rect(this.margin + (boxWidth + spacing) * 2, summaryY, boxWidth, boxHeight).fill();
    this.doc.fillColor('white').fontSize(10).font('Helvetica-Bold');
    this.doc.text('Total AED', this.margin + (boxWidth + spacing) * 2 + 5, summaryY + 5);
    this.doc.fontSize(12).text(new Intl.NumberFormat('en-US', { style: 'currency', currency: 'AED' }).format(totalAmountAED), this.margin + (boxWidth + spacing) * 2 + 5, summaryY + 20);
    
    // Paid Amount
    this.doc.fillColor('#ef4444').rect(this.margin + (boxWidth + spacing) * 3, summaryY, boxWidth, boxHeight).fill();
    this.doc.fillColor('white').fontSize(10).font('Helvetica-Bold');
    this.doc.text('Paid PKR', this.margin + (boxWidth + spacing) * 3 + 5, summaryY + 5);
    this.doc.fontSize(12).text(new Intl.NumberFormat('en-US', { style: 'currency', currency: 'PKR' }).format(totalPaidPKR), this.margin + (boxWidth + spacing) * 3 + 5, summaryY + 20);
    
    // Outstanding Amount
    this.doc.fillColor('#8b5cf6').rect(this.margin + (boxWidth + spacing) * 4, summaryY, boxWidth, boxHeight).fill();
    this.doc.fillColor('white').fontSize(10).font('Helvetica-Bold');
    this.doc.text('Outstanding PKR', this.margin + (boxWidth + spacing) * 4 + 5, summaryY + 5);
    this.doc.fontSize(12).text(new Intl.NumberFormat('en-US', { style: 'currency', currency: 'PKR' }).format(totalOutstandingPKR), this.margin + (boxWidth + spacing) * 4 + 5, summaryY + 20);
    
    // Table
    const tableY = summaryY + boxHeight + 50; // Increased spacing between summary and table
    this.doc.fontSize(14).font('Helvetica-Bold');
    this.doc.fillColor('#2d3748');
    this.doc.text('Transport Invoices', this.margin, tableY);
    
    // Table headers
    const headers = ['Invoice #', 'Agent', 'Amount (PKR)', 'Amount (AED)', 'Paid (PKR)', 'Outstanding (PKR)', 'Status', 'Due Date'];
    const columnWidths = [60, 70, 70, 70, 70, 80, 55, 70];
    const startX = this.margin;
    let currentX = startX;
    
    this.doc.fontSize(9).font('Helvetica-Bold');
    this.doc.fillColor('#4a5568');
    headers.forEach((header, index) => {
      this.doc.text(header, currentX + 2, tableY + 20, { width: columnWidths[index] - 4, align: 'center' });
      currentX += columnWidths[index];
    });
    
    // Table data
    this.doc.fontSize(9).font('Helvetica');
    this.doc.fillColor('#2d3748');
    let currentY = tableY + 40;
    
    transportInvoices.forEach((invoice, index) => {
      if (currentY > this.doc.page.height - 100) {
        this.doc.addPage();
        currentY = 50;
      }
      
      currentX = startX;
      
      // Invoice number
      this.doc.text(invoice.invoice_number, currentX + 2, currentY + 6, { width: columnWidths[0] - 4 }); // Adjusted y offset for larger row
      currentX += columnWidths[0];
      
      // Agent
      this.doc.text(invoice.agent, currentX + 2, currentY + 6, { width: columnWidths[1] - 4 }); // Adjusted y offset
      currentX += columnWidths[1];
      
      // Amount PKR
      this.doc.text(new Intl.NumberFormat('en-US', { style: 'currency', currency: 'PKR' }).format(invoice.amount_pkr), currentX + 2, currentY + 6, { width: columnWidths[2] - 4, align: 'right' }); // Adjusted y offset
      currentX += columnWidths[2];
      
      // Amount AED
      this.doc.text(new Intl.NumberFormat('en-US', { style: 'currency', currency: 'AED' }).format(invoice.amount_aed), currentX + 2, currentY + 6, { width: columnWidths[3] - 4, align: 'right' }); // Adjusted y offset
      currentX += columnWidths[3];
      
      // Paid PKR
      this.doc.text(new Intl.NumberFormat('en-US', { style: 'currency', currency: 'PKR' }).format(invoice.paid_amount_pkr), currentX + 2, currentY + 6, { width: columnWidths[4] - 4, align: 'right' }); // Adjusted y offset
      currentX += columnWidths[4];
      
      // Outstanding PKR
      this.doc.text(new Intl.NumberFormat('en-US', { style: 'currency', currency: 'PKR' }).format(invoice.outstanding_amount_pkr), currentX + 2, currentY + 6, { width: columnWidths[5] - 4, align: 'right' }); // Adjusted y offset
      currentX += columnWidths[5];
      
      // Status
      this.doc.text(invoice.status.replace('_', ' ').toUpperCase(), currentX + 2, currentY + 6, { width: columnWidths[6] - 4, align: 'center' }); // Adjusted y offset
      currentX += columnWidths[6];
      
      // Due Date
      this.doc.text(new Date(invoice.due_date).toLocaleDateString(), currentX + 2, currentY + 6, { width: columnWidths[7] - 4, align: 'center' }); // Adjusted y offset
      
      currentY += 30; // Increased row height by 1.5x (20 * 1.5 = 30)
    });
    
    this.doc.end();
  }

  // Generate transport report CSV
  generateTransportReportCSV(res, transportInvoices, options = {}) {
    const csvData = [];
    
    // Headers
    csvData.push([
      'Invoice Number',
      'Agent',
      'Amount (PKR)',
      'Amount (AED)',
      'Paid (PKR)',
      'Outstanding (PKR)',
      'Status',
      'Invoice Date',
      'Due Date',
      'Last Payment Date'
    ]);
    
    // Data rows
    transportInvoices.forEach(invoice => {
      csvData.push([
        invoice.invoice_number,
        invoice.agent,
        invoice.amount_pkr,
        invoice.amount_aed,
        invoice.paid_amount_pkr,
        invoice.outstanding_amount_pkr,
        invoice.status.replace('_', ' ').toUpperCase(),
        new Date(invoice.invoice_date).toLocaleDateString(),
        new Date(invoice.due_date).toLocaleDateString(),
        invoice.last_payment_date ? new Date(invoice.last_payment_date).toLocaleDateString() : ''
      ]);
    });
    
    // Convert to CSV string
    const csvString = csvData.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    
    // Set headers for CSV download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=transport-report-${new Date().toISOString().split('T')[0]}.csv`);
    
    res.send(csvString);
  }

  // Generate customer outstanding amounts report
  generateCustomerOutstandingReport(res, customerOutstanding) {
    const doc = this.initDocument(res, `customer-outstanding-${new Date().toISOString().split('T')[0]}.pdf`);
    
    // Header
    this.doc.fontSize(20).font('Helvetica-Bold');
    this.doc.fillColor('#2d3748');
    this.doc.text('CUSTOMER OUTSTANDING AMOUNTS REPORT', this.margin, 50, { align: 'center' });
    
    // Subtitle
    this.doc.fontSize(12).font('Helvetica');
    this.doc.fillColor('#4a5568');
    this.doc.text(`Generated on: ${new Date().toLocaleDateString('en-GB')}`, this.margin, 80, { align: 'center' });
    
    // Summary
    const totalOutstanding = customerOutstanding.reduce((sum, customer) => sum + customer.totalOutstanding, 0);
    const totalCustomers = customerOutstanding.length;
    
    this.doc.fontSize(14).font('Helvetica-Bold');
    this.doc.fillColor('#2d3748');
    this.doc.text('SUMMARY', this.margin, 120);
    
    this.doc.fontSize(10).font('Helvetica');
    this.doc.fillColor('#4a5568');
    this.doc.text(`Total Customers with Outstanding: ${totalCustomers}`, this.margin, 140);
    this.doc.text(`Total Outstanding Amount: AED ${totalOutstanding.toLocaleString()}`, this.margin, 155);
    
    // Table header
    this.currentY = 180;
    this.doc.y = this.currentY;
    
    const columnWidths = [250, 120, 120];
    const headers = ['Customer Name', 'Outstanding', 'Status'];
    
    // Draw table header
    this.doc.fontSize(12).font('Helvetica-Bold');
    this.doc.fillColor('#2d3748');
    this.doc.strokeColor('#e2e8f0');
    this.doc.lineWidth(1);
    
    let x = this.margin;
    headers.forEach((header, index) => {
      this.doc.rect(x, this.currentY, columnWidths[index], 30).stroke();
      this.doc.text(header, x + 5, this.currentY + 10, { width: columnWidths[index] - 10 });
      x += columnWidths[index];
    });
    
    this.currentY += 30;
    
    // Draw table rows
    customerOutstanding.forEach((customer, index) => {
      // Check if we need a new page
      if (this.currentY > this.pageHeight - 100) {
        this.doc.addPage();
        this.currentY = 50;
        this.doc.y = this.currentY;
      }
      
      const y = this.currentY;
      
      // Alternate row colors
      this.doc.fillColor(index % 2 === 0 ? '#f7fafc' : 'white');
      this.doc.rect(this.margin, y, columnWidths.reduce((a, b) => a + b, 0), 25).fill();
      this.doc.fillColor('black');
      
      let x = this.margin;
      this.doc.fontSize(11).font('Helvetica');
      
      // Customer Name
      this.doc.font('Helvetica-Bold');
      this.doc.text(customer.customerName, x + 5, y + 8, { width: columnWidths[0] - 10, ellipsis: true });
      x += columnWidths[0];
      
      // Outstanding Amount
      this.doc.font('Helvetica-Bold');
      this.doc.fillColor('#e53e3e');
      this.doc.text(`AED ${customer.totalOutstanding.toLocaleString()}`, x + 5, y + 8, { width: columnWidths[1] - 10, align: 'right' });
      this.doc.fillColor('black');
      x += columnWidths[1];
      
      // Status
      this.doc.font('Helvetica-Bold');
      const statusColor = customer.status === 'overdue' ? '#e53e3e' : 
                         customer.status === 'partially_paid' ? '#d69e2e' : '#3182ce';
      this.doc.fillColor(statusColor);
      this.doc.text(customer.status.replace('_', ' ').toUpperCase(), x + 5, y + 8, { width: columnWidths[2] - 10, align: 'center' });
      this.doc.fillColor('black');
      
      this.currentY += 25;
    });
    
    // Footer
    this.doc.fontSize(10).font('Helvetica');
    this.doc.fillColor('#4a5568');
    this.doc.text(`Report generated on ${new Date().toLocaleString('en-GB')}`, this.margin, this.pageHeight - 50, { align: 'center' });
    
    this.doc.end();
  }

  // Generate Container Statement PDF
  generateContainerStatement(res, statement) {
    const filename = `container-statement-${statement.containerNo}-${new Date().toISOString().split('T')[0]}.pdf`;
    const doc = this.initDocument(res, filename);

    // Header
    this.doc.fontSize(20).font('Helvetica-Bold');
    this.doc.fillColor('#1f2937');
    this.doc.text('CONTAINER STATEMENT', this.margin, 50, { align: 'center' });
    this.doc.moveDown(0.5);
    this.doc.fontSize(11).font('Helvetica');
    this.doc.fillColor('#4b5563');
    this.doc.text(`Container: ${statement.containerNo}`, this.margin, 80, { align: 'center' });
    this.doc.text(`Generated on: ${new Date().toLocaleDateString('en-GB')}`, this.margin, 96, { align: 'center' });

    this.currentY = 120;
    this.doc.y = this.currentY;

    // Group products by product + unitPrice
    const map = new Map();
    (statement.products || []).forEach(p => {
      const key = `${p.product}__${Number(p.unitPrice).toFixed(2)}`;
      const ex = map.get(key);
      if (ex) {
        ex.quantity += p.quantity || 0;
        ex.amountWithoutVAT += p.amountWithoutVAT || 0;
      } else {
        map.set(key, {
          product: p.product,
          unitPrice: Number(p.unitPrice) || 0,
          quantity: Number(p.quantity) || 0,
          amountWithoutVAT: Number(p.amountWithoutVAT) || 0,
        });
      }
    });
    const rows = Array.from(map.values()).sort((a,b)=>a.unitPrice-b.unitPrice);

    // Summary strip (minimal, professional): three bordered tiles with headings and values
    const tileWidth = (this.contentWidth - 20) / 3;
    const tileHeight = 52;
    const startX = this.margin;
    const startY = this.currentY;
    const gross = rows.reduce((s,r)=>s + r.amountWithoutVAT, 0);
    const expensesTotal = (statement.expenses || []).reduce((s,e)=> s + (e.amount || 0), 0);
    const net = gross - expensesTotal;

    const tiles = [
      { label: 'Gross Sale', value: `AED ${gross.toLocaleString()}` },
      { label: 'Expenses', value: `AED ${expensesTotal.toLocaleString()}` },
      { label: 'Net Sale', value: `AED ${net.toLocaleString()}` },
    ];

    this.doc.strokeColor('#e5e7eb');
    this.doc.fillColor('white');
    tiles.forEach((t, i) => {
      const x = startX + i * (tileWidth + 10);
      // tile border
      this.doc.rect(x, startY, tileWidth, tileHeight).stroke();
      // header
      this.doc.fontSize(9).font('Helvetica').fillColor('#6b7280');
      this.doc.text(t.label.toUpperCase(), x + 8, startY + 8, { width: tileWidth - 16 });
      // value
      this.doc.fontSize(14).font('Helvetica-Bold').fillColor('#111827');
      this.doc.text(t.value, x + 8, startY + 24, { width: tileWidth - 16, align: 'right' });
    });
    this.doc.fillColor('black');
    this.currentY = startY + tileHeight + 24;
    this.doc.y = this.currentY;

    // Products table
    this.doc.fontSize(14).font('Helvetica-Bold').fillColor('#1f2937');
    this.doc.text('Product Details', this.margin, this.currentY);
    this.currentY += 20;

    const headers = ['SR #', 'PRODUCT', 'QTY', 'UNIT PRICE', 'AMOUNT (AED)'];
    const columnWidths = [45, 200, 70, 90, 120];
    this.drawTableHeader(headers, columnWidths, this.currentY);
    this.currentY += 35;

    rows.forEach((r, idx) => {
      if (this.currentY + 25 > this.pageHeight - 100) {
        this.addNewPage();
        this.drawTableHeader(headers, columnWidths, this.currentY);
        this.currentY += 35;
      }
      const y = this.currentY;
      // Row background
      this.doc.fillColor(idx % 2 === 0 ? '#f7fafc' : 'white');
      this.doc.rect(this.margin, y, columnWidths.reduce((a,b)=>a+b,0), 25).fill();
      this.doc.fillColor('#111827').fontSize(10).font('Helvetica');
      let x = this.margin;
      this.doc.text(String(idx+1), x + 5, y + 8, { width: columnWidths[0]-10, align: 'left' }); x += columnWidths[0];
      this.doc.font('Helvetica-Bold').text(r.product, x + 5, y + 8, { width: columnWidths[1]-10 }); x += columnWidths[1];
      this.doc.font('Helvetica').text(r.quantity.toLocaleString(), x + 5, y + 8, { width: columnWidths[2]-10, align: 'right' }); x += columnWidths[2];
      this.doc.text(r.unitPrice.toFixed(2), x + 5, y + 8, { width: columnWidths[3]-10, align: 'right' }); x += columnWidths[3];
      this.doc.font('Helvetica-Bold').text(r.amountWithoutVAT.toLocaleString(), x + 5, y + 8, { width: columnWidths[4]-10, align: 'right' });
      this.currentY += 25;
    });

    // Total row
    const totalWidth = columnWidths.reduce((a,b)=>a+b,0);
    this.doc.fillColor('#e5e7eb');
    this.doc.rect(this.margin, this.currentY, totalWidth, 25).fill();
    this.doc.fillColor('#111827').font('Helvetica-Bold');
    this.doc.text('Total', this.margin + 5, this.currentY + 8, { width: columnWidths[0] + columnWidths[1] - 10 });
    const totalQty = rows.reduce((s,r)=>s+r.quantity, 0);
    let tx = this.margin + columnWidths[0] + columnWidths[1];
    this.doc.text(totalQty.toLocaleString(), tx + 5, this.currentY + 8, { width: columnWidths[2]-10, align: 'right' }); tx += columnWidths[2];
    this.doc.text('', tx + 5, this.currentY + 8, { width: columnWidths[3]-10 }); tx += columnWidths[3];
    this.doc.text(gross.toLocaleString(), tx + 5, this.currentY + 8, { width: columnWidths[4]-10, align: 'right' });
    this.currentY += 35;

    // Expenses table (if any)
    if ((statement.expenses || []).length > 0) {
      this.doc.fontSize(14).font('Helvetica-Bold').fillColor('#1f2937');
      this.doc.text('Expenses', this.margin, this.currentY);
      this.currentY += 20;
      const eHeaders = ['DESCRIPTION', 'AMOUNT (AED)'];
      const eWidths = [350, 175];
      this.drawTableHeader(eHeaders, eWidths, this.currentY);
      this.currentY += 35;
      (statement.expenses || []).forEach((e, i)=>{
        if (this.currentY + 25 > this.pageHeight - 100) {
          this.addNewPage();
          this.drawTableHeader(eHeaders, eWidths, this.currentY);
          this.currentY += 35;
        }
        const y = this.currentY;
        this.doc.fillColor(i % 2 === 0 ? '#f7fafc' : 'white');
        this.doc.rect(this.margin, y, eWidths.reduce((a,b)=>a+b,0), 25).fill();
        this.doc.fillColor('#111827').fontSize(10).font('Helvetica');
        this.doc.text(this.sanitizeField(e.description), this.margin + 5, y + 8, { width: eWidths[0] - 10 });
        this.doc.font('Helvetica-Bold').text((e.amount || 0).toLocaleString(), this.margin + eWidths[0] + 5, y + 8, { width: eWidths[1] - 10, align: 'right' });
        this.currentY += 25;
      });

      // Expenses subtotal
      const eTotalWidth = eWidths.reduce((a,b)=>a+b,0);
      this.doc.fillColor('#e5e7eb');
      this.doc.rect(this.margin, this.currentY, eTotalWidth, 25).fill();
      this.doc.fillColor('#111827').font('Helvetica-Bold');
      this.doc.text('Sub Total', this.margin + 5, this.currentY + 8, { width: eWidths[0] - 10 });
      this.doc.text(expensesTotal.toLocaleString(), this.margin + eWidths[0] + 5, this.currentY + 8, { width: eWidths[1] - 10, align: 'right' });
      this.currentY += 35;
    }

    // Final calculation table: Total Sale - Expenses = Net Sale
    this.doc.fontSize(14).font('Helvetica-Bold').fillColor('#1f2937');
    this.doc.text('Final Calculation', this.margin, this.currentY);
    this.currentY += 18;

    const fColWidths = [300, 225];
    const tableTotalWidth = fColWidths[0] + fColWidths[1];
    const rowHeight = 24;

    // Header
    this.doc.fillColor('#f3f4f6');
    this.doc.rect(this.margin, this.currentY, tableTotalWidth, rowHeight).fill();
    this.doc.fillColor('#374151').fontSize(10).font('Helvetica-Bold');
    this.doc.text('DESCRIPTION', this.margin + 8, this.currentY + 7, { width: fColWidths[0] - 16 });
    this.doc.text('AMOUNT (AED)', this.margin + fColWidths[0] + 8, this.currentY + 7, { width: fColWidths[1] - 16, align: 'right' });
    this.currentY += rowHeight;

    // Rows
    const finalRows = [
      { label: 'Total Sale', value: gross },
      { label: 'Less: Expenses', value: -expensesTotal },
      { label: 'Net Sale', value: net, bold: true }
    ];

    finalRows.forEach((r, idx) => {
      const isNet = !!r.bold;
      const bg = isNet ? '#111827' : (idx % 2 === 0 ? '#ffffff' : '#f9fafb');
      const fg = isNet ? '#ffffff' : '#111827';

      // background
      this.doc.fillColor(bg);
      this.doc.rect(this.margin, this.currentY, tableTotalWidth, rowHeight).fill();

      // text
      this.doc.fillColor(fg).fontSize(10).font(r.bold ? 'Helvetica-Bold' : 'Helvetica');
      this.doc.text(r.label, this.margin + 8, this.currentY + 7, { width: fColWidths[0] - 16 });
      const valText = `${r.value < 0 ? '-' : ''}AED ${Math.abs(r.value).toLocaleString()}`;
      this.doc.text(valText, this.margin + fColWidths[0] + 8, this.currentY + 7, { width: fColWidths[1] - 16, align: 'right' });

      this.currentY += rowHeight;
    });

    this.currentY += 15;

    // Footer
    this.addFooter();
    doc.end();
  }

  // Generate freight report PDF
  generateFreightReport(res, data) {
    const doc = this.initDocument(res, `freight-report-${new Date().toISOString().split('T')[0]}.pdf`);
    
    // Add header
    this.addFreightHeader();
    
    // Add filters
    this.addFreightFilters(data.filters);
    
    // Add summary
    this.addFreightSummary(data.invoices);
    
    // Group payments by invoice ID
    const paymentsByInvoice = {};
    if (data.payments && data.payments.length > 0) {
      data.payments.forEach(payment => {
        if (!paymentsByInvoice[payment.freightInvoiceId]) {
          paymentsByInvoice[payment.freightInvoiceId] = [];
        }
        paymentsByInvoice[payment.freightInvoiceId].push(payment);
      });
    }
    
    // Add freight table
    this.addFreightTable(data.invoices, data.includePayments, paymentsByInvoice);
    
    // Add footer
    this.addFooter();
    
    // Finalize the PDF
    doc.end();
  }

  // Add freight-specific header
  addFreightHeader(companyName = 'KOTIA FRUITS AND VEGETABLES TRADING LLC') {
    this.doc.fillColor('#1a365d');
    this.doc.fontSize(24).font('Helvetica-Bold');
    this.doc.text(companyName, { align: 'center' });
    
    this.doc.moveDown(1);
    this.doc.fontSize(14).font('Helvetica');
    this.doc.fillColor('#4a5568');
    this.doc.text('FREIGHT INVOICE REPORT', { align: 'center' });
    
    this.doc.moveDown(2);
    this.currentY = this.doc.y;
  }

  // Add freight filters
  addFreightFilters(filters) {
    if (!filters || Object.keys(filters).length === 0) return;

    this.doc.fontSize(12).font('Helvetica-Bold');
    this.doc.fillColor('#2d3748');
    this.doc.text('Report Filters:', this.margin, this.currentY);
    this.doc.moveDown(0.5);

    this.doc.fontSize(10).font('Helvetica');
    this.doc.fillColor('#4a5568');
    
    let filterText = '';
    if (filters.startDate && filters.endDate) {
      filterText += `Date Range: ${new Date(filters.startDate).toLocaleDateString()} - ${new Date(filters.endDate).toLocaleDateString()}`;
    }
    if (filters.agent) {
      filterText += filterText ? ' | ' : '';
      filterText += `Agent: ${filters.agent}`;
    }
    if (filters.status) {
      filterText += filterText ? ' | ' : '';
      filterText += `Status: ${filters.status}`;
    }
    if (filters.minAmount || filters.maxAmount) {
      filterText += filterText ? ' | ' : '';
      filterText += `Amount Range: ${filters.minAmount || '0'} - ${filters.maxAmount || '∞'}`;
    }

    if (filterText) {
      this.doc.text(filterText);
      this.doc.moveDown(2);
    }
    
    this.currentY = this.doc.y;
  }

  // Add freight summary section
  addFreightSummary(invoices) {
    this.doc.fontSize(16).font('Helvetica-Bold');
    this.doc.fillColor('#2d3748');
    this.doc.text('SUMMARY', this.margin, this.currentY);
    this.doc.moveDown(2);

    // Calculate summary
    const totalInvoices = invoices.length;
    const totalAmountPKR = invoices.reduce((sum, inv) => sum + (inv.amount_pkr || 0), 0);
    const totalAmountAED = invoices.reduce((sum, inv) => sum + (inv.amount_aed || 0), 0);
    const totalReceivedPKR = invoices.reduce((sum, inv) => sum + (inv.received_amount_pkr || 0), 0);
    const totalOutstandingPKR = invoices.reduce((sum, inv) => sum + (inv.outstanding_amount_pkr || 0), 0);

    // Create summary boxes
    const boxWidth = (this.contentWidth - 30) / 4;
    const boxHeight = 60;
    const startX = this.margin;
    const startY = this.currentY + 10;

    // Total Invoices Box
    this.drawSummaryBox(startX, startY, boxWidth, boxHeight, '#4299e1', 'Total Invoices', totalInvoices.toString(), '#2b6cb0');

    // Total PKR Box
    this.drawSummaryBox(startX + boxWidth + 10, startY, boxWidth, boxHeight, '#48bb78', 'Total PKR', `PKR ${totalAmountPKR.toLocaleString()}`, '#2f855a');

    // Total AED Box
    this.drawSummaryBox(startX + (boxWidth + 10) * 2, startY, boxWidth, boxHeight, '#ed8936', 'Total AED', `AED ${totalAmountAED.toLocaleString()}`, '#c05621');

    // Outstanding PKR Box
    this.drawSummaryBox(startX + (boxWidth + 10) * 3, startY, boxWidth, boxHeight, '#f56565', 'Outstanding PKR', `PKR ${totalOutstandingPKR.toLocaleString()}`, '#c53030');

    this.currentY = startY + boxHeight + 60;
    this.doc.y = this.currentY;
  }

  // Add freight table
  addFreightTable(invoices, includePayments = false, paymentsByInvoice = {}) {
    this.doc.fontSize(14).font('Helvetica-Bold');
    this.doc.fillColor('#2d3748');
    this.doc.text('FREIGHT INVOICE DETAILS', this.margin, this.currentY);
    this.doc.moveDown(3); // Increased spacing between heading and table

    // Table headers
    const headers = ['Invoice #', 'Agent', 'Amount PKR', 'Amount AED', 'Received PKR', 'Outstanding PKR', 'Status', 'Due Date'];
    const columnWidths = [60, 70, 70, 70, 70, 80, 55, 70];
    const totalWidth = columnWidths.reduce((a, b) => a + b, 0);

    this.drawTableHeader(headers, columnWidths, this.currentY + 10);
    this.currentY += 35;

         // Table rows
     invoices.forEach((invoice, index) => {
       // Check if we need a new page
       const rowHeight = 38; // Increased row height by 1.5x (25 * 1.5 = 37.5, rounded to 38)
       const paymentHeight = includePayments && paymentsByInvoice[invoice._id.toString()] ? 
         (20) + (paymentsByInvoice[invoice._id.toString()].length * 18) : 0;
       const totalRowHeight = rowHeight + paymentHeight + (paymentHeight ? 25 : 0);
       
       if (this.currentY + totalRowHeight > this.pageHeight - 100) {
         this.addNewPage();
         this.drawTableHeader(headers, columnWidths, this.currentY);
         this.currentY += 40; // Increased header spacing
       }

       this.drawFreightRow(invoice, columnWidths, this.currentY, index);
       this.currentY += rowHeight;

       // Add payment details if requested
       if (includePayments && paymentsByInvoice[invoice._id.toString()]) {
         const invoicePayments = paymentsByInvoice[invoice._id.toString()];
         const paymentsStartY = this.currentY;
         this.addFreightPaymentDetails(invoicePayments, columnWidths, paymentsStartY);
         this.currentY += 20 + (invoicePayments.length * 18) + 10 + 5;
       }
     });

    this.currentY += 30;
    this.doc.y = this.currentY;
  }

     // Draw freight row
   drawFreightRow(invoice, columnWidths, y, index) {
     // Alternate row colors
     this.doc.fillColor(index % 2 === 0 ? '#f7fafc' : 'white');
     this.doc.rect(this.margin, y, columnWidths.reduce((a, b) => a + b, 0), 38).fill(); // Increased height to match rowHeight
     this.doc.fillColor('black');
     
     let x = this.margin;
     this.doc.fontSize(9).font('Helvetica'); // Increased font size
     
     // Invoice Number
     this.doc.font('Helvetica-Bold');
     this.doc.text(invoice.invoice_number || '', x + 5, y + 12, { width: columnWidths[0] - 10 }); // Adjusted y offset for larger row
     x += columnWidths[0];
     
     // Agent
     this.doc.font('Helvetica');
     this.doc.text(invoice.agent || '', x + 5, y + 12, { width: columnWidths[1] - 10, ellipsis: true }); // Adjusted y offset
     x += columnWidths[1];
     
     // Amount PKR
     this.doc.font('Helvetica-Bold');
     const amountPKR = (invoice.amount_pkr || 0).toLocaleString();
     this.doc.text(`PKR ${amountPKR}`, x + 5, y + 12, { width: columnWidths[2] - 10, align: 'right' }); // Adjusted y offset
     x += columnWidths[2];
     
     // Amount AED
     const amountAED = (invoice.amount_aed || 0).toLocaleString();
     this.doc.text(`AED ${amountAED}`, x + 5, y + 12, { width: columnWidths[3] - 10, align: 'right' }); // Adjusted y offset
     x += columnWidths[3];
     
     // Received PKR
     this.doc.fillColor('#48bb78');
     const receivedPKR = (invoice.received_amount_pkr || 0).toLocaleString();
     this.doc.text(`PKR ${receivedPKR}`, x + 5, y + 12, { width: columnWidths[4] - 10, align: 'right' }); // Adjusted y offset
     x += columnWidths[4];
     
     // Outstanding PKR
     this.doc.fillColor('#f56565');
     const outstandingPKR = (invoice.outstanding_amount_pkr || 0).toLocaleString();
     this.doc.text(`PKR ${outstandingPKR}`, x + 5, y + 12, { width: columnWidths[5] - 10, align: 'right' }); // Adjusted y offset
     x += columnWidths[5];
     
     // Status
     this.doc.fillColor(this.getStatusColor(invoice.status));
     const statusText = (invoice.status || '').replace('_', ' ').toUpperCase();
     this.doc.text(statusText, x + 5, y + 12, { width: columnWidths[6] - 10, align: 'center' }); // Adjusted y offset
     x += columnWidths[6];
     
     // Due Date
     this.doc.fillColor('black');
     this.doc.font('Helvetica');
     const dueDate = invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('en-GB') : '';
     this.doc.text(dueDate, x + 5, y + 12, { width: columnWidths[7] - 10 }); // Adjusted y offset
   }

     // Add freight payment details
   addFreightPaymentDetails(payments, columnWidths, startY) {
     const tableWidth = columnWidths.reduce((a, b) => a + b, 0);

     // Thin separator line
     this.doc.strokeColor('#cbd5e0');
     this.doc.lineWidth(0.5);
     this.doc.moveTo(this.margin, startY - 5).lineTo(this.margin + tableWidth, startY - 5).stroke();

     // Draw border around payment block
     const blockHeight = 20 + (payments.length * 18);
     this.doc.strokeColor('#cbd5e0');
     this.doc.lineWidth(0.75);
     this.doc.rect(this.margin, startY, tableWidth, blockHeight).stroke();

     // Header bar
     this.doc.fillColor('#e9ecef');
     this.doc.rect(this.margin, startY, tableWidth, 20).fill();
     this.doc.fillColor('#2d3748');
     this.doc.fontSize(9).font('Helvetica-Bold');
     this.doc.text('PAYMENT TRANSACTIONS:', this.margin + 8, startY + 6);
     this.doc.fillColor('black');
     
     // Payment rows
     const indentStartX = this.margin + 10;
     payments.forEach((payment, index) => {
       const y = startY + 20 + (index * 18);
       
       this.doc.fontSize(8).font('Helvetica');
       this.doc.fillColor('#f8f9fa');
       this.doc.rect(this.margin, y, tableWidth, 18).fill();
       this.doc.fillColor('black');
       
       let x = indentStartX;
       
       // Payment Date
       const paymentDate = payment.paymentDate ? new Date(payment.paymentDate).toLocaleDateString('en-GB') : '';
       this.doc.text(paymentDate, x + 5, y + 5, { width: columnWidths[0] - 10 });
       x += columnWidths[0];
       
              // Payment Amount
        this.doc.fillColor('#28a745');
        this.doc.font('Helvetica-Bold');
        const paymentAmount = (payment.amount || 0).toLocaleString();
        this.doc.text(`PKR ${paymentAmount}`, x + 5, y + 5, { width: columnWidths[1] - 10, align: 'right' });
        x += columnWidths[1];
        
        // Payment Method
        this.doc.fillColor('black');
        this.doc.font('Helvetica');
        const paymentMethod = (payment.paymentMethod || '').replace('_', ' ').toUpperCase();
        this.doc.text(paymentMethod, x + 5, y + 5, { width: columnWidths[2] - 10 });
        x += columnWidths[2];
        
        // Payment Type
        const paymentType = (payment.paymentType || '').toUpperCase();
        this.doc.text(paymentType, x + 5, y + 5, { width: columnWidths[3] - 10 });
        x += columnWidths[3];
       
       // Reference
       this.doc.text(payment.reference || '-', x + 5, y + 5, { width: columnWidths[4] - 10 });
       x += columnWidths[4];
       
       // Notes
       this.doc.text(payment.notes || '-', x + 5, y + 5, { width: columnWidths[5] - 10 });
       x += columnWidths[5];
       
              // Received By
        const receivedBy = typeof payment.receivedBy === 'object' ? payment.receivedBy.name : payment.receivedBy;
        this.doc.text(this.sanitizeReceivedBy(receivedBy), x + 5, y + 5, { width: columnWidths[6] - 10 });
     });

     // Bottom separator
     const endY = startY + blockHeight + 5;
     this.doc.strokeColor('#a0aec0');
     this.doc.lineWidth(0.75);
     this.doc.moveTo(this.margin, endY).lineTo(this.margin + tableWidth, endY).stroke();

     this.doc.strokeColor('black');
     this.doc.lineWidth(1);
   }

  // Generate freight report CSV
  generateFreightReportCSV(res, data) {
    const csv = this.generateFreightCSV(data);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="freight-report-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
  }

  // Generate freight CSV content
  generateFreightCSV(data) {
    const { invoices, payments, includePayments } = data;
    
    let csv = 'Invoice Number,Agent,Amount PKR,Amount AED,Received PKR,Outstanding PKR,Status,Due Date,Invoice Date\n';
    
    invoices.forEach(invoice => {
      const row = [
        invoice.invoice_number || '',
        invoice.agent || '',
        invoice.amount_pkr || 0,
        invoice.amount_aed || 0,
        invoice.received_amount_pkr || 0,
        invoice.outstanding_amount_pkr || 0,
        invoice.status || '',
        invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('en-GB') : '',
        invoice.invoice_date ? new Date(invoice.invoice_date).toLocaleDateString('en-GB') : ''
      ].map(field => `"${field}"`).join(',');
      
      csv += row + '\n';
      
      // Add payment details if requested
      if (includePayments && payments) {
        const invoicePayments = payments.filter(p => p.freightInvoiceId === invoice._id.toString());
        invoicePayments.forEach(payment => {
          const paymentRow = [
            `  Payment: ${payment.paymentDate ? new Date(payment.paymentDate).toLocaleDateString('en-GB') : ''}`,
            `  PKR ${payment.amount || 0}`,
            (payment.paymentMethod || '').replace('_', ' ').toUpperCase(),
            (payment.paymentType || '').toUpperCase(),
            payment.reference || '',
            payment.notes || '',
            typeof payment.receivedBy === 'object' ? payment.receivedBy.name : payment.receivedBy || ''
          ].map(field => `"${field}"`).join(',');
          
          csv += paymentRow + '\n';
        });
      }
    });
    
    return csv;
  }

  // Generate Dubai transport invoice
  generateDubaiTransportInvoice(res, invoice) {
    const filename = `dubai-transport-invoice-${invoice.invoice_number}.pdf`;
    const doc = this.initDocument(res, filename);

    // Header
    this.doc.fontSize(20).font('Helvetica-Bold');
    this.doc.text('Dubai Transport Invoice', this.margin, 50, { align: 'center' });
    this.doc.moveDown();

    // Invoice details
    this.doc.fontSize(12).font('Helvetica');
    this.doc.text(`Invoice Number: ${invoice.invoice_number}`, this.margin, 100);
    this.doc.text(`Date: ${new Date(invoice.invoice_date).toLocaleDateString()}`, this.margin, 120);
    this.doc.text(`Due Date: ${new Date(invoice.due_date).toLocaleDateString()}`, this.margin, 140);
    this.doc.text(`Agent: ${invoice.agent}`, this.margin, 160);
    this.doc.moveDown();

    // Amount details
    this.doc.fontSize(14).font('Helvetica-Bold');
    this.doc.text(`Amount (AED): ${invoice.amount_aed.toFixed(2)}`, this.margin, 200);
    this.doc.text(`Paid Amount (AED): ${invoice.paid_amount_aed.toFixed(2)}`, this.margin, 220);
    this.doc.text(`Outstanding Amount (AED): ${invoice.outstanding_amount_aed.toFixed(2)}`, this.margin, 240);
    this.doc.text(`Status: ${invoice.status.toUpperCase()}`, this.margin, 260);

    this.doc.end();
  }

  // Generate Dubai transport report
  generateDubaiTransportReport(res, dubaiTransportInvoices, options = {}) {
    const filename = `dubai-transport-report-${new Date().toISOString().split('T')[0]}.pdf`;
    const doc = this.initDocument(res, filename);

    // Header
    this.doc.fontSize(20).font('Helvetica-Bold');
    this.doc.text('Dubai Transport Report', this.margin, 50, { align: 'center' });
    this.doc.moveDown();

    // Summary
    const totalInvoices = dubaiTransportInvoices.length;
    const totalAmount = dubaiTransportInvoices.reduce((sum, inv) => sum + inv.amount_aed, 0);
    const totalPaid = dubaiTransportInvoices.reduce((sum, inv) => sum + inv.paid_amount_aed, 0);
    const totalOutstanding = dubaiTransportInvoices.reduce((sum, inv) => sum + inv.outstanding_amount_aed, 0);

    this.doc.fontSize(12).font('Helvetica');
    this.doc.text(`Total Invoices: ${totalInvoices}`, this.margin, 100);
    this.doc.text(`Total Amount (AED): ${totalAmount.toFixed(2)}`, this.margin, 120);
    this.doc.text(`Total Paid (AED): ${totalPaid.toFixed(2)}`, this.margin, 140);
    this.doc.text(`Total Outstanding (AED): ${totalOutstanding.toFixed(2)}`, this.margin, 160);
    this.doc.moveDown();

    // Table header with proper column widths
    const tableY = 200;
    const columnWidths = [80, 120, 100, 100, 120, 80];
    const startX = this.margin;
    let currentX = startX;
    
    this.doc.fontSize(9).font('Helvetica-Bold');
    this.doc.fillColor('#4a5568');
    
    // Headers
    const headers = ['Invoice #', 'Agent', 'Amount (AED)', 'Paid (AED)', 'Outstanding (AED)', 'Status'];
    headers.forEach((header, index) => {
      this.doc.text(header, currentX + 2, tableY, { width: columnWidths[index] - 4, align: 'center' });
      currentX += columnWidths[index];
    });

    // Table data
    let currentY = tableY + 20;
    this.doc.fontSize(8).font('Helvetica');
    this.doc.fillColor('#2d3748');
    
    dubaiTransportInvoices.forEach(invoice => {
      if (currentY > this.pageHeight - 100) {
        this.doc.addPage();
        currentY = 50;
      }

      currentX = startX;
      
      // Invoice number
      this.doc.text(invoice.invoice_number, currentX + 2, currentY, { width: columnWidths[0] - 4 });
      currentX += columnWidths[0];
      
      // Agent
      this.doc.text(invoice.agent, currentX + 2, currentY, { width: columnWidths[1] - 4 });
      currentX += columnWidths[1];
      
      // Amount AED
      this.doc.text(invoice.amount_aed.toFixed(2), currentX + 2, currentY, { width: columnWidths[2] - 4, align: 'right' });
      currentX += columnWidths[2];
      
      // Paid AED
      this.doc.text(invoice.paid_amount_aed.toFixed(2), currentX + 2, currentY, { width: columnWidths[3] - 4, align: 'right' });
      currentX += columnWidths[3];
      
      // Outstanding AED
      this.doc.text(invoice.outstanding_amount_aed.toFixed(2), currentX + 2, currentY, { width: columnWidths[4] - 4, align: 'right' });
      currentX += columnWidths[4];
      
      // Status
      this.doc.text(invoice.status.toUpperCase(), currentX + 2, currentY, { width: columnWidths[5] - 4, align: 'center' });

      currentY += 15;
    });

    this.doc.end();
  }

  // Generate Dubai transport report CSV
  generateDubaiTransportReportCSV(res, dubaiTransportInvoices, options = {}) {
    const filename = `dubai-transport-report-${new Date().toISOString().split('T')[0]}.csv`;
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    let csv = 'Invoice #,Agent,Amount (AED),Paid (AED),Outstanding (AED),Status,Due Date,Invoice Date\n';
    
    dubaiTransportInvoices.forEach(invoice => {
      csv += `"${invoice.invoice_number}","${invoice.agent}",${invoice.amount_aed},${invoice.paid_amount_aed},${invoice.outstanding_amount_aed},"${invoice.status}","${new Date(invoice.due_date).toLocaleDateString()}","${new Date(invoice.invoice_date).toLocaleDateString()}"\n`;
    });
    
    res.send(csv);
  }

  // Generate Dubai clearance invoice
  generateDubaiClearanceInvoice(res, invoice) {
    const filename = `dubai-clearance-invoice-${invoice.invoice_number}.pdf`;
    const doc = this.initDocument(res, filename);

    // Header
    this.doc.fontSize(20).font('Helvetica-Bold');
    this.doc.text('Dubai Clearance Invoice', this.margin, 50, { align: 'center' });
    this.doc.moveDown();

    // Invoice details
    this.doc.fontSize(12).font('Helvetica');
    this.doc.text(`Invoice Number: ${invoice.invoice_number}`, this.margin, 100);
    this.doc.text(`Date: ${new Date(invoice.invoice_date).toLocaleDateString()}`, this.margin, 120);
    this.doc.text(`Due Date: ${new Date(invoice.due_date).toLocaleDateString()}`, this.margin, 140);
    this.doc.text(`Agent: ${invoice.agent}`, this.margin, 160);
    this.doc.moveDown();

    // Amount details
    this.doc.fontSize(14).font('Helvetica-Bold');
    this.doc.text(`Amount (AED): ${invoice.amount_aed.toFixed(2)}`, this.margin, 200);
    this.doc.text(`Paid Amount (AED): ${invoice.paid_amount_aed.toFixed(2)}`, this.margin, 220);
    this.doc.text(`Outstanding Amount (AED): ${invoice.outstanding_amount_aed.toFixed(2)}`, this.margin, 240);
    this.doc.text(`Status: ${invoice.status.toUpperCase()}`, this.margin, 260);

    this.doc.end();
  }

  // Generate Dubai clearance report
  generateDubaiClearanceReport(res, dubaiClearanceInvoices, options = {}) {
    const filename = `dubai-clearance-report-${new Date().toISOString().split('T')[0]}.pdf`;
    const doc = this.initDocument(res, filename);

    // Header
    this.doc.fontSize(20).font('Helvetica-Bold');
    this.doc.text('Dubai Clearance Report', this.margin, 50, { align: 'center' });
    this.doc.moveDown();

    // Summary
    const totalInvoices = dubaiClearanceInvoices.length;
    const totalAmount = dubaiClearanceInvoices.reduce((sum, inv) => sum + inv.amount_aed, 0);
    const totalPaid = dubaiClearanceInvoices.reduce((sum, inv) => sum + inv.paid_amount_aed, 0);
    const totalOutstanding = dubaiClearanceInvoices.reduce((sum, inv) => sum + inv.outstanding_amount_aed, 0);

    this.doc.fontSize(12).font('Helvetica');
    this.doc.text(`Total Invoices: ${totalInvoices}`, this.margin, 100);
    this.doc.text(`Total Amount (AED): ${totalAmount.toFixed(2)}`, this.margin, 120);
    this.doc.text(`Total Paid (AED): ${totalPaid.toFixed(2)}`, this.margin, 140);
    this.doc.text(`Total Outstanding (AED): ${totalOutstanding.toFixed(2)}`, this.margin, 160);
    this.doc.moveDown();

    // Table header with proper column widths
    const tableY = 200;
    const columnWidths = [80, 120, 100, 100, 120, 80];
    const startX = this.margin;
    let currentX = startX;
    
    this.doc.fontSize(9).font('Helvetica-Bold');
    this.doc.fillColor('#4a5568');
    
    // Headers
    const headers = ['Invoice #', 'Agent', 'Amount (AED)', 'Paid (AED)', 'Outstanding (AED)', 'Status'];
    headers.forEach((header, index) => {
      this.doc.text(header, currentX + 2, tableY, { width: columnWidths[index] - 4, align: 'center' });
      currentX += columnWidths[index];
    });

    // Table data
    let currentY = tableY + 20;
    this.doc.fontSize(8).font('Helvetica');
    this.doc.fillColor('#2d3748');
    
    dubaiClearanceInvoices.forEach(invoice => {
      if (currentY > this.pageHeight - 100) {
        this.doc.addPage();
        currentY = 50;
      }

      currentX = startX;
      
      // Invoice number
      this.doc.text(invoice.invoice_number, currentX + 2, currentY, { width: columnWidths[0] - 4 });
      currentX += columnWidths[0];
      
      // Agent
      this.doc.text(invoice.agent, currentX + 2, currentY, { width: columnWidths[1] - 4 });
      currentX += columnWidths[1];
      
      // Amount AED
      this.doc.text(invoice.amount_aed.toFixed(2), currentX + 2, currentY, { width: columnWidths[2] - 4, align: 'right' });
      currentX += columnWidths[2];
      
      // Paid AED
      this.doc.text(invoice.paid_amount_aed.toFixed(2), currentX + 2, currentY, { width: columnWidths[3] - 4, align: 'right' });
      currentX += columnWidths[3];
      
      // Outstanding AED
      this.doc.text(invoice.outstanding_amount_aed.toFixed(2), currentX + 2, currentY, { width: columnWidths[4] - 4, align: 'right' });
      currentX += columnWidths[4];
      
      // Status
      this.doc.text(invoice.status.toUpperCase(), currentX + 2, currentY, { width: columnWidths[5] - 4, align: 'center' });

      currentY += 15;
    });

    this.doc.end();
  }

  // Generate Dubai clearance report CSV
  generateDubaiClearanceReportCSV(res, dubaiClearanceInvoices, options = {}) {
    const filename = `dubai-clearance-report-${new Date().toISOString().split('T')[0]}.csv`;
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    let csv = 'Invoice #,Agent,Amount (AED),Paid (AED),Outstanding (AED),Status,Due Date,Invoice Date\n';
    
    dubaiClearanceInvoices.forEach(invoice => {
      csv += `"${invoice.invoice_number}","${invoice.agent}",${invoice.amount_aed},${invoice.paid_amount_aed},${invoice.outstanding_amount_aed},"${invoice.status}","${new Date(invoice.due_date).toLocaleDateString()}","${new Date(invoice.invoice_date).toLocaleDateString()}"\n`;
    });
    
    res.send(csv);
  }
}

module.exports = PDFGenerator;
