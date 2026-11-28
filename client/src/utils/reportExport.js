import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType
} from 'docx';

function formatPeriodLabel(fromDate, toDate) {
  if (fromDate && toDate) return `${fromDate} — ${toDate}`;
  if (fromDate) return `De la ${fromDate}`;
  if (toDate) return `Până la ${toDate}`;
  return 'Toată perioada';
}

function toPdfSafe(value) {
  return String(value ?? '')
    .replace(/ă/g, 'a')
    .replace(/Ă/g, 'A')
    .replace(/â/g, 'a')
    .replace(/Â/g, 'A')
    .replace(/î/g, 'i')
    .replace(/Î/g, 'I')
    .replace(/[șş]/g, 's')
    .replace(/[ȘŞ]/g, 'S')
    .replace(/[țţ]/g, 't')
    .replace(/[ȚŢ]/g, 'T')
    .replace(/—/g, '-');
}

function triggerBlobDownload(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export function exportReportExcel(reports, { fromDate, toDate } = {}) {
  const summary = reports?.summary || {};
  const usersByRole = reports?.users_by_role || {};
  const period = formatPeriodLabel(fromDate, toDate);

  const summaryRows = [
    { Indicator: 'Perioadă raport', Valoare: period },
    { Indicator: 'Total Programări', Valoare: summary.total_appointments ?? 0 },
    { Indicator: 'Programări Confirmate', Valoare: summary.confirmed_count ?? 0 },
    { Indicator: 'Programări Finalizate', Valoare: summary.completed_count ?? 0 },
    { Indicator: 'Programări Anulate', Valoare: summary.cancelled_count ?? 0 },
    { Indicator: 'Rată Confirmare (%)', Valoare: summary.confirmation_rate ?? 0 },
    { Indicator: 'Rată Anulare (%)', Valoare: summary.cancellation_rate ?? 0 },
    { Indicator: 'Încasări la Recepție (RON)', Valoare: Number(summary.total_revenue_paid || 0).toFixed(2) },
    { Indicator: 'Neîncasat (RON)', Valoare: Number(summary.total_revenue_unpaid || 0).toFixed(2) },
    { Indicator: 'Medici Activi', Valoare: usersByRole.DOCTOR ?? 0 },
    { Indicator: 'Pacienți Activi', Valoare: usersByRole.PATIENT ?? 0 },
    { Indicator: 'Recepționeri Activi', Valoare: usersByRole.RECEPTIONIST ?? 0 }
  ];

  const doctorRows = (reports?.by_doctor || []).map((doc) => ({
    Medic: doc.doctor_name,
    Specializare: doc.specialization_name,
    Cabinet: doc.cabinet_number,
    'Tarif (RON)': Number(doc.consultation_price || 0).toFixed(2),
    'Total Programări': doc.total_appointments,
    'Confirmate / Finalizate': doc.active_confirmed,
    Anulate: doc.cancelled_count,
    'Grad Ocupare (%)': doc.occupancy_rate,
    'Încasări Recepție (RON)': Number(doc.paid_revenue || 0).toFixed(2)
  }));

  const specRows = (reports?.by_specialization || []).map((sp) => ({
    Specializare: sp.specialization_name,
    'Nr. Medici': sp.doctors_count,
    'Total Programări': sp.total_appointments,
    'Active / Finalizate': sp.active_appointments,
    'Încasări Recepție (RON)': Number(sp.paid_revenue || 0).toFixed(2)
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), 'Sumar KPI');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(doctorRows), 'Medici & Ocupare');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(specRows), 'Specializari');

  XLSX.writeFile(wb, 'raport-clinicaweb.xlsx');
}

function buildDocxCell(text, { bold = false, shading = undefined } = {}) {
  return new TableCell({
    shading: shading ? { fill: shading } : undefined,
    children: [
      new Paragraph({
        children: [new TextRun({ text: String(text ?? ''), bold, size: 20 })]
      })
    ]
  });
}

function buildDocxTable(headers, rows) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: headers.map((h) => buildDocxCell(h, { bold: true, shading: 'E9EEF5' }))
      }),
      ...rows.map(
        (row) =>
          new TableRow({
            children: row.map((cell) => buildDocxCell(cell))
          })
      )
    ]
  });
}

export async function exportReportWord(reports, { fromDate, toDate } = {}) {
  const summary = reports?.summary || {};
  const usersByRole = reports?.users_by_role || {};
  const period = formatPeriodLabel(fromDate, toDate);
  const generatedAt = new Date().toLocaleString('ro-RO');

  const kpiRows = [
    ['Total Programări', summary.total_appointments ?? 0],
    ['Confirmate / Finalizate', `${summary.confirmed_count ?? 0} / ${summary.completed_count ?? 0}`],
    ['Rată Confirmare / Anulare', `${summary.confirmation_rate ?? 0}% / ${summary.cancellation_rate ?? 0}%`],
    ['Încasări la Recepție', `${Number(summary.total_revenue_paid || 0).toFixed(2)} RON`],
    ['Neîncasat', `${Number(summary.total_revenue_unpaid || 0).toFixed(2)} RON`],
    ['Medici / Pacienți / Recepție', `${usersByRole.DOCTOR ?? 0} / ${usersByRole.PATIENT ?? 0} / ${usersByRole.RECEPTIONIST ?? 0}`]
  ];

  const doctorRows = (reports?.by_doctor || []).map((doc) => [
    doc.doctor_name,
    doc.specialization_name,
    doc.cabinet_number,
    doc.total_appointments,
    doc.cancelled_count,
    `${doc.occupancy_rate}%`,
    `${Number(doc.paid_revenue || 0).toFixed(2)} RON`
  ]);

  const specRows = (reports?.by_specialization || []).map((sp) => [
    sp.specialization_name,
    sp.doctors_count,
    sp.total_appointments,
    sp.active_appointments,
    `${Number(sp.paid_revenue || 0).toFixed(2)} RON`
  ]);

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.LEFT,
            children: [new TextRun({ text: 'ClinicaWeb — Raport Administrativ & KPI', bold: true })]
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [
              new TextRun({ text: `Perioadă: ${period}  |  Generat la: ${generatedAt}`, italics: true, size: 20 })
            ]
          }),
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 100 },
            children: [new TextRun({ text: '1. Sumar Indicatori KPI', bold: true })]
          }),
          buildDocxTable(['Indicator', 'Valoare'], kpiRows),
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 100 },
            children: [new TextRun({ text: '2. Grad de Ocupare & Încasări per Medic', bold: true })]
          }),
          buildDocxTable(
            ['Medic', 'Specializare', 'Cabinet', 'Programări', 'Anulate', 'Ocupare', 'Încasări'],
            doctorRows
          ),
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 100 },
            children: [new TextRun({ text: '3. Situație per Specializare Medicală', bold: true })]
          }),
          buildDocxTable(
            ['Specializare', 'Nr. Medici', 'Total Programări', 'Active / Finalizate', 'Încasări'],
            specRows
          )
        ]
      }
    ]
  });

  const blob = await Packer.toBlob(doc);
  triggerBlobDownload(blob, 'raport-clinicaweb.docx');
}

export function exportReportPdf(reports, { fromDate, toDate } = {}) {
  const summary = reports?.summary || {};
  const usersByRole = reports?.users_by_role || {};
  const period = toPdfSafe(formatPeriodLabel(fromDate, toDate));
  const generatedAt = toPdfSafe(new Date().toLocaleString('ro-RO'));

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  pdf.setFontSize(16);
  pdf.setTextColor(15, 29, 53);
  pdf.text('ClinicaWeb - Raport Administrativ & KPI', 14, 18);

  pdf.setFontSize(10);
  pdf.setTextColor(100, 116, 139);
  pdf.text(`Perioada: ${period} | Generat la: ${generatedAt}`, 14, 25);

  autoTable(pdf, {
    startY: 32,
    head: [['Indicator KPI', 'Valoare']],
    body: [
      ['Total Programari', String(summary.total_appointments ?? 0)],
      ['Confirmate / Finalizate', `${summary.confirmed_count ?? 0} / ${summary.completed_count ?? 0}`],
      ['Rata Confirmare / Anulare', `${summary.confirmation_rate ?? 0}% / ${summary.cancellation_rate ?? 0}%`],
      ['Incasari la Receptie', `${Number(summary.total_revenue_paid || 0).toFixed(2)} RON`],
      ['Neincasat', `${Number(summary.total_revenue_unpaid || 0).toFixed(2)} RON`],
      [
        'Medici / Pacienti / Receptie',
        `${usersByRole.DOCTOR ?? 0} / ${usersByRole.PATIENT ?? 0} / ${usersByRole.RECEPTIONIST ?? 0}`
      ]
    ],
    theme: 'grid',
    headStyles: { fillColor: [15, 29, 53] },
    styles: { fontSize: 9 }
  });

  const afterKpiY = pdf.lastAutoTable.finalY + 8;
  pdf.setFontSize(12);
  pdf.setTextColor(15, 29, 53);
  pdf.text('Grad de Ocupare & Incasari per Medic', 14, afterKpiY);

  autoTable(pdf, {
    startY: afterKpiY + 3,
    head: [['Medic', 'Specializare', 'Cabinet', 'Programari', 'Anulate', 'Ocupare', 'Incasari']],
    body: (reports?.by_doctor || []).map((doc) => [
      toPdfSafe(doc.doctor_name),
      toPdfSafe(doc.specialization_name),
      toPdfSafe(doc.cabinet_number),
      String(doc.total_appointments),
      String(doc.cancelled_count),
      `${doc.occupancy_rate}%`,
      `${Number(doc.paid_revenue || 0).toFixed(2)} RON`
    ]),
    theme: 'striped',
    headStyles: { fillColor: [13, 110, 253] },
    styles: { fontSize: 8 }
  });

  const afterDocY = pdf.lastAutoTable.finalY + 8;
  pdf.setFontSize(12);
  pdf.setTextColor(15, 29, 53);
  pdf.text('Situatie per Specializare Medicala', 14, afterDocY);

  autoTable(pdf, {
    startY: afterDocY + 3,
    head: [['Specializare', 'Nr. Medici', 'Total Programari', 'Active / Finalizate', 'Incasari']],
    body: (reports?.by_specialization || []).map((sp) => [
      toPdfSafe(sp.specialization_name),
      String(sp.doctors_count),
      String(sp.total_appointments),
      String(sp.active_appointments),
      `${Number(sp.paid_revenue || 0).toFixed(2)} RON`
    ]),
    theme: 'striped',
    headStyles: { fillColor: [25, 135, 84] },
    styles: { fontSize: 8 }
  });

  pdf.save('raport-clinicaweb.pdf');
}

