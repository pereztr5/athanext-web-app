import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { PdfSection } from "@/utils/dataExport";

/** Saves "Your AthaNext data" as a PDF. Each section is a heading and a table. */
export const downloadDataPdf = (sections: PdfSection[], filename: string) => {
  const wide = sections.some((section) => section.columns.length > 5);
  const doc = new jsPDF({ unit: "pt", format: "letter", orientation: wide ? "landscape" : "portrait" });
  const generated = new Date().toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" });
  doc.setFontSize(16);
  doc.text("Your AthaNext data", 40, 44);
  doc.setFontSize(10);
  doc.setTextColor(104, 107, 114);
  doc.text(`Generated ${generated}`, 40, 62);
  doc.setTextColor(26, 32, 44);

  let startY = 84;
  sections.forEach((section) => {
    if (startY > (wide ? 520 : 700)) {
      doc.addPage();
      startY = 48;
    }
    doc.setFontSize(12);
    doc.text(section.title, 40, startY);
    if (!section.rows.length) {
      doc.setFontSize(10);
      doc.setTextColor(104, 107, 114);
      doc.text("Nothing saved", 40, startY + 16);
      doc.setTextColor(26, 32, 44);
      startY += 40;
      return;
    }
    autoTable(doc, {
      startY: startY + 8,
      head: [section.columns],
      body: section.rows,
      styles: { fontSize: 8, cellPadding: 4, overflow: "linebreak" },
      headStyles: { fillColor: [0, 84, 180], textColor: 255 },
      margin: { left: 40, right: 40 },
    });
    startY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? startY + 40;
    startY += 28;
  });

  doc.save(filename);
};
