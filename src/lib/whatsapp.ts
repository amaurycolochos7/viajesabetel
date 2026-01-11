import { Passenger } from '@/types'

const WHATSAPP_NUMBER = '5219618720544'

export function buildWhatsAppMessage(
    reservationCode: string,
    responsibleName: string,
    responsiblePhone: string,
    congregation: string | undefined,
    passengers: Passenger[],
    seatsPayable: number,
    totalAmount: number,
    depositRequired: number
): string {
    const minorsCount = passengers.filter(p => p.age !== undefined && p.age < 6).length
    const seatsTotal = passengers.length

    let message = `👋 *¡Hola! Quiero confirmar mi viaje a Betel*\n`
    message += `📅 *7-9 de Abril 2026*\n\n`

    message += `📋 *DETALLES DE LA RESERVA*\n`
    message += `🆔 *Código:* ${reservationCode}\n`
    message += `👤 *Responsable:* ${responsibleName}\n`
    message += `📞 *Tel:* ${responsiblePhone}\n`
    if (congregation) {
        message += `📍 *Congregación:* ${congregation}\n`
    }

    message += `\n🚌 *VIAJEROS (${seatsTotal})*\n`
    passengers.forEach((p, i) => {
        let passengerLine = `${i + 1}. ${p.first_name} ${p.last_name}`
        if (p.age !== undefined && p.age < 6) passengerLine += ` (Menor, ${p.age} años)`
        message += passengerLine + `\n`
    })

    message += `\n💰 *PAGO Y CONFIRMACIÓN*\n`
    message += `💳 *Total:* $${totalAmount.toLocaleString('es-MX')} MXN\n`
    message += `💵 *Anticipo:* $${depositRequired.toLocaleString('es-MX')} MXN (50%)\n`

    message += `\n🏦 *DATOS DE TRANSFERENCIA*\n`
    message += `• *Banco:* Mercado Pago\n`
    message += `• *Beneficiario:* Gady Hernández\n`
    message += `• *CLABE:* 722969010994673004\n\n`

    message += `📎 *IMPORTANTE:*\n`
    message += `Por favor adjunta el comprobante de pago a este chat para confirmar tus lugares.`

    return message
}

export function getWhatsAppLink(message: string): string {
    const encodedMessage = encodeURIComponent(message)
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodedMessage}`
}
