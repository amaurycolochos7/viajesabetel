'use client'

import { useRef, useEffect } from 'react'

// Global function to start music - can be called from other components
let startMusicCallback: (() => void) | null = null

export function startBackgroundMusic() {
    if (startMusicCallback) {
        startMusicCallback()
    }
}

export default function BackgroundMusic() {
    const audioRef = useRef<HTMLAudioElement | null>(null)
    const hasStartedRef = useRef(false)

    useEffect(() => {
        // Register the callback
        startMusicCallback = () => {
            if (!hasStartedRef.current && audioRef.current) {
                audioRef.current.volume = 0.4
                audioRef.current.play()
                    .then(() => {
                        hasStartedRef.current = true
                    })
                    .catch((err) => console.error('Play failed:', err))
            }
        }

        return () => {
            startMusicCallback = null
        }
    }, [])

    // Completely invisible - just the audio element
    return (
        <audio
            ref={audioRef}
            loop
            src="/background-music.mp3"
            style={{ display: 'none' }}
        />
    )
}
