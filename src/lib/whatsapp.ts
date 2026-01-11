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

    let message = `*Reserva: ${reservationCode}*\n\n`
    message += `*Responsable:* ${responsibleName}\n`
    message += `*Tel:* ${responsiblePhone}\n`
    if (congregation) {
        message += `*Congregación:* ${congregation}\n`
    }
    message += `\n`
    message += `*Lugares:* ${seatsTotal}`
    if (minorsCount > 0) {
        message += ` (pagan ${seatsPayable}; ${minorsCount} menor${minorsCount > 1 ? 'es' : ''} <6)`
    }
    message += `\n`
    message += `*Total:* $${totalAmount.toLocaleString('es-MX')} MXN\n`
    message += `*Anticipo mínimo (50%):* $${depositRequired.toLocaleString('es-MX')} MXN\n\n`

    message += `*Pasajeros:*\n`
    passengers.forEach((p, i) => {
        let passengerLine = `${i + 1}. ${p.first_name} ${p.last_name}`
        if (p.congregation) passengerLine += ` - ${p.congregation}`
        if (p.age !== undefined && p.age < 6) passengerLine += ` (${p.age} años)`
        message += passengerLine + `\n`
    })

    message += `\n*Método de pago:* Transferencia\n`
    message += `*CLABE:* 722969010994673004\n`
    message += `*Banco:* Mercado Pago\n`
    message += `*Beneficiario:* Gady Hernández\n\n`
    message += `Adjunta tu comprobante a este chat.\n`
    message += `Los asientos se asignan por orden de pago confirmado.`

    return message
}

export function getWhatsAppLink(message: string): string {
    const encodedMessage = encodeURIComponent(message)
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodedMessage}`
}
