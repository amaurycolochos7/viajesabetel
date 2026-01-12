import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

interface CartItem {
    activityId: string
    variantId: string
    quantity: number
    price: number
    name: string
    variantName: string
    passengerId: string
    passengerName: string
}

interface OrderData {
    id: string
    total_amount: number
    payment_method: string
    status: string
    created_at: string
    items: CartItem[]
}

interface ReservationData {
    reservation_code: string
    responsible_name: string
}

export function generateTicketPDF(
    orderData: OrderData,
    reservationData: ReservationData
) {
    const doc = new jsPDF()

    // Colors from the site theme
    const primaryColor: [number, number, number] = [74, 109, 167] // #4a6da7
    const accentColor: [number, number, number] = [139, 105, 20] // #8b6914
    const darkGray: [number, number, number] = [85, 85, 85]
    const lightGray: [number, number, number] = [245, 245, 245]

    // Header with brand colors
    doc.setFillColor(...primaryColor)
    doc.rect(0, 0, 210, 35, 'F')

    doc.setTextColor(255, 255, 255)
    doc.setFontSize(24)
    doc.setFont('helvetica', 'bold')
    doc.text('VAMOS A BETEL 2026', 105, 15, { align: 'center' })

    doc.setFontSize(14)
    doc.setFont('helvetica', 'normal')
    doc.text('Comprobante de Compra - Centros Turísticos', 105, 25, { align: 'center' })

    // Reset text color for body
    doc.setTextColor(...darkGray)

    // Reservation Info Box
    let yPos = 45
    doc.setFillColor(...lightGray)
    doc.roundedRect(15, yPos, 180, 30, 3, 3, 'F')

    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('Información de Reservación', 20, yPos + 8)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text(`Código de Reservación: ${reservationData.reservation_code}`, 20, yPos + 16)
    doc.text(`Responsable: ${reservationData.responsible_name}`, 20, yPos + 23)

    // Order Details
    yPos += 40
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('Detalles de la Orden', 20, yPos)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    const orderDate = new Date(orderData.created_at).toLocaleDateString('es-MX', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    })
    doc.text(`Fecha de compra: ${orderDate}`, 20, yPos + 7)
    doc.text(`Método de pago: ${orderData.payment_method === 'transfer' ? 'Transferencia Bancaria' : 'Tarjeta (MercadoPago)'}`, 20, yPos + 13)
    doc.text(`Estado: ${orderData.status === 'paid' ? 'Pagado' : 'Pendiente'}`, 20, yPos + 19)

    // Tickets Table
    yPos += 30
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('Entradas Compradas', 20, yPos)

    // Group items by attraction
    const groupedItems: { [key: string]: CartItem[] } = {}
    orderData.items.forEach(item => {
        if (!groupedItems[item.name]) {
            groupedItems[item.name] = []
        }
        groupedItems[item.name].push(item)
    })

    yPos += 8
    const tableData: any[] = []

    Object.entries(groupedItems).forEach(([attractionName, items]) => {
        // Add attraction header row
        tableData.push([
            { content: attractionName, colSpan: 3, styles: { fontStyle: 'bold', fillColor: primaryColor, textColor: [255, 255, 255] } }
        ])

        // Add individual tickets
        items.forEach(item => {
            tableData.push([
                `${item.passengerName}`,
                `${item.variantName}`,
                `$${item.price.toLocaleString('es-MX')}`
            ])
        })
    })

    // Add table using autoTable plugin
    autoTable(doc, {
        startY: yPos,
        head: [['Pasajero', 'Tipo de Entrada', 'Precio']],
        body: tableData,
        theme: 'striped',
        headStyles: {
            fillColor: accentColor,
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 10
        },
        bodyStyles: {
            fontSize: 9
        },
        alternateRowStyles: {
            fillColor: [250, 250, 250]
        },
        margin: { left: 15, right: 15 }
    })

    // Total
    const finalY = (doc as any).lastAutoTable.finalY + 10
    doc.setFillColor(...primaryColor)
    doc.roundedRect(15, finalY, 180, 15, 3, 3, 'F')

    doc.setTextColor(255, 255, 255)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('TOTAL:', 25, finalY + 10)
    doc.text(`$${orderData.total_amount.toLocaleString('es-MX')} MXN`, 185, finalY + 10, { align: 'right' })

    // Footer - Only show warning if payment is pending
    if (orderData.status !== 'paid') {
        const footerY = finalY + 25
        doc.setTextColor(200, 50, 50)
        doc.setFontSize(9)
        doc.setFont('helvetica', 'bold')
        doc.text('PAGO PENDIENTE - Completa tu pago para confirmar tu reservación.', 105, footerY, { align: 'center' })
    }

    // Download the PDF
    const fileName = `tickets-${reservationData.reservation_code}.pdf`
    doc.save(fileName)
}
