import { jsPDF } from 'jspdf'

interface AttractionCartItem {
    packageId: string
    packageName: string
    quantity: number
    unitPrice: number
    total: number
}

interface AttractionReservationData {
    reservationCode: string
    attractionCode: string
    responsibleName: string
    betelCode: string
    cart: AttractionCartItem[]
    totalAmount: number
}

export function generateAttractionReceiptPDF(data: AttractionReservationData) {
    const doc = new jsPDF()

    // Colores
    const primaryColor: [number, number, number] = [37, 99, 235] // Azul
    const accentColor: [number, number, number] = [22, 163, 74] // Verde
    const darkGray: [number, number, number] = [51, 65, 85]
    const orangeColor: [number, number, number] = [234, 88, 12]

    // Header con gradiente visual
    doc.setFillColor(...primaryColor)
    doc.rect(0, 0, 210, 40, 'F')

    doc.setTextColor(255, 255, 255)
    doc.setFontSize(22)
    doc.setFont('helvetica', 'bold')
    doc.text('VAMOS A BETEL 2026', 105, 15, { align: 'center' })

    doc.setFontSize(14)
    doc.setFont('helvetica', 'normal')
    doc.text('Pre-Reserva de Paquetes de Atracciones', 105, 26, { align: 'center' })

    doc.setFontSize(10)
    doc.text('Museos y Acuario de Veracruz', 105, 35, { align: 'center' })

    // Codigo de reserva destacado
    let yPos = 55
    doc.setFillColor(...accentColor)
    doc.roundedRect(15, yPos, 180, 25, 4, 4, 'F')

    doc.setTextColor(255, 255, 255)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('CODIGO DE PRE-RESERVA', 105, yPos + 10, { align: 'center' })

    doc.setFontSize(18)
    doc.text(data.attractionCode, 105, yPos + 20, { align: 'center' })

    // Informacion del responsable
    yPos += 35
    doc.setTextColor(...darkGray)
    doc.setFillColor(248, 250, 252)
    doc.roundedRect(15, yPos, 180, 30, 3, 3, 'F')

    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('Datos de la Reservacion', 20, yPos + 8)

    doc.setFont('helvetica', 'normal')
    doc.text(`Responsable: ${data.responsibleName}`, 20, yPos + 16)
    doc.text(`Codigo Betel: ${data.betelCode}`, 20, yPos + 23)

    const fecha = new Date().toLocaleDateString('es-MX', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    })
    doc.text(`Fecha: ${fecha}`, 115, yPos + 16)

    // Detalle de paquetes
    yPos += 40
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('Paquetes Reservados', 20, yPos)

    yPos += 8
    doc.setFillColor(...primaryColor)
    doc.setTextColor(255, 255, 255)
    doc.rect(15, yPos, 180, 10, 'F')
    doc.setFontSize(10)
    doc.text('Paquete', 20, yPos + 7)
    doc.text('Cant.', 115, yPos + 7)
    doc.text('Precio c/u', 140, yPos + 7)
    doc.text('Subtotal', 175, yPos + 7)

    yPos += 12
    doc.setTextColor(...darkGray)
    doc.setFont('helvetica', 'normal')

    data.cart.forEach((item, idx) => {
        const bgColor = idx % 2 === 0 ? [255, 255, 255] : [248, 250, 252]
        doc.setFillColor(bgColor[0], bgColor[1], bgColor[2])
        doc.rect(15, yPos - 2, 180, 10, 'F')

        doc.text(item.packageName, 20, yPos + 5)
        doc.text(item.quantity.toString(), 120, yPos + 5)
        doc.text(`$${item.unitPrice}`, 140, yPos + 5)
        doc.setFont('helvetica', 'bold')
        doc.text(`$${item.total}`, 175, yPos + 5)
        doc.setFont('helvetica', 'normal')

        yPos += 10
    })

    // Total
    yPos += 5
    doc.setFillColor(...primaryColor)
    doc.roundedRect(15, yPos, 180, 15, 3, 3, 'F')

    doc.setTextColor(255, 255, 255)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('TOTAL A PAGAR:', 25, yPos + 10)
    doc.text(`$${data.totalAmount.toLocaleString('es-MX')} MXN`, 185, yPos + 10, { align: 'right' })

    // Datos bancarios
    yPos += 25
    doc.setTextColor(...darkGray)
    doc.setFillColor(254, 243, 199) // Amarillo claro
    doc.roundedRect(15, yPos, 180, 40, 3, 3, 'F')

    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...orangeColor)
    doc.text('DATOS PARA TRANSFERENCIA', 105, yPos + 10, { align: 'center' })

    doc.setTextColor(...darkGray)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text('Banco: Mercado Pago', 20, yPos + 20)
    doc.text('CLABE: 722969010994673004', 20, yPos + 28)
    doc.text('Beneficiario: Gady Hernandez', 20, yPos + 36)

    doc.setFont('helvetica', 'bold')
    doc.text(`Concepto: ${data.responsibleName} - Atracciones`, 115, yPos + 28)

    // Nota importante
    yPos += 50
    doc.setFillColor(254, 226, 226) // Rojo claro
    doc.roundedRect(15, yPos, 180, 20, 3, 3, 'F')

    doc.setTextColor(185, 28, 28)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text('IMPORTANTE: Esta es una PRE-RESERVA.', 105, yPos + 8, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    doc.text('Realiza tu transferencia y envia el comprobante por WhatsApp para confirmar.', 105, yPos + 15, { align: 'center' })

    // Footer
    yPos += 30
    doc.setTextColor(148, 163, 184)
    doc.setFontSize(8)
    doc.text('Viaje a Betel 2026 - Veracruz, Mexico', 105, yPos, { align: 'center' })
    doc.text('WhatsApp: +52 961 872 0544', 105, yPos + 5, { align: 'center' })

    // Guardar
    const fileName = `prereserva-atracciones-${data.attractionCode}.pdf`
    doc.save(fileName)
}
