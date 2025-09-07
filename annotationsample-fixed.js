const fs = require('fs');

async function createAnnotatedPDF() {
  try {
    console.log('Creating PDF with annotation...');

    // Import pdf-lib
    const { PDFDocument, StandardFonts, rgb } = require('./cjs/index');
    const {
      AnnotationTypes,
    } = require('./cjs/core/annotation/AnnotationTypes');

    console.log('PDF-lib loaded successfully');

    // Create a new PDF document
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([600, 400]);
    console.log('Page created');

    // Add some text first
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    page.drawText('This text will be highlighted', {
      x: 50,
      y: 300,
      size: 12,
      font: helveticaFont,
      color: rgb(0, 0, 0),
    });
    console.log('Text added');

    // Try to add a highlight annotation
    try {
      const highlight = page.addTextMarkupAnnotation({
        subtype: AnnotationTypes.Highlight,
        color: [1, 1, 0], // Yellow
        rect: {
          x: 50,
          y: 300,
          width: 150,
          height: 20,
        },
        contents: 'This is a highlight annotation',
        quadPoints: {
          leftbottomX: 50,
          leftbottomY: 300,
          lefttopX: 50,
          lefttopY: 320,
          righttopX: 200,
          righttopY: 320,
          rightbottomX: 200,
          rightbottomY: 300,
        },
      });
      console.log('Annotation added successfully');
    } catch (annotationError) {
      console.log('Could not add annotation:', annotationError.message);
      console.log('Proceeding without annotation...');
    }

    // Save the PDF
    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync('annotationsample.pdf', pdfBytes);
    console.log('PDF created successfully: annotationsample.pdf');
  } catch (error) {
    console.error('Error creating PDF:', error);
  }
}

// Run the function
createAnnotatedPDF();
