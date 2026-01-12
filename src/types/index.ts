export interface Passenger {
    first_name: string
    last_name: string
    phone?: string
    congregation?: string
    age?: number
    observations?: string
    is_infant?: boolean
    passenger_type?: 'adult' | 'child' | 'infant'
}

export interface ReservationData {
    responsible_name: string
    responsible_phone: string
    responsible_congregation?: string
    passengers: Passenger[]
}

export interface Reservation {
    id: string
    reservation_code: string
    boarding_access_code?: string
    responsible_name: string
    responsible_phone: string
    responsible_congregation?: string
    seats_total: number
    seats_payable: number
    unit_price: number
    total_amount: number
    deposit_required: number
    amount_paid: number
    status: 'pendiente' | 'anticipo_pagado' | 'pagado_completo' | 'cancelado'
    seat_order?: number
    pay_by_date?: string
    payment_method?: 'card' | 'transfer' | null
    mp_payment_status?: 'pending' | 'approved' | 'rejected' | null
    created_at: string
}

export interface ReservationPassenger {
    id: string
    reservation_id: string
    first_name: string
    last_name: string
    phone?: string
    congregation?: string
    age?: number
    is_free_under6: boolean
    observations?: string
    boarded?: boolean
    seat_number?: string
    created_at: string
}

export interface Payment {
    id: string
    reservation_id: string
    amount: number
    paid_at: string
    method: string
    reference?: string
    note?: string
}
