'use client'

import { useEffect, useRef, useState } from 'react'

export default function BackgroundMusic() {
    const audioRef = useRef<HTMLAudioElement | null>(null)
    const [isPlaying, setIsPlaying] = useState(false)
    const [hasInteracted, setHasInteracted] = useState(false)

    useEffect(() => {
        // Attempt to play on mount
        const playAudio = async () => {
            if (audioRef.current) {
                try {
                    audioRef.current.volume = 0.4 // 40% volume to not be annoying
                    await audioRef.current.play()
                    setIsPlaying(true)
                } catch (err) {
                    console.log('Autoplay blocked by browser policy, waiting for interaction', err)
                    setIsPlaying(false)
                }
            }
        }

        playAudio()

        // Fallback: Play on first interaction if autoplay failed
        const handleInteraction = () => {
            if (!hasInteracted && audioRef.current) {
                audioRef.current.play().then(() => {
                    setIsPlaying(true)
                    setHasInteracted(true)
                }).catch(e => console.error(e))
            }
        }

        window.addEventListener('click', handleInteraction)
        window.addEventListener('scroll', handleInteraction)

        return () => {
            window.removeEventListener('click', handleInteraction)
            window.removeEventListener('scroll', handleInteraction)
        }
    }, [hasInteracted])

    const togglePlay = () => {
        if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.pause()
            } else {
                audioRef.current.play()
            }
            setIsPlaying(!isPlaying)
        }
    }

    return (
        <div style={{ position: 'fixed', bottom: '20px', left: '20px', zIndex: 9999 }}>
            <audio ref={audioRef} loop src="/background-music.mp3" />
            <button
                onClick={togglePlay}
                style={{
                    background: 'rgba(255, 255, 255, 0.8)',
                    border: '1px solid rgba(0,0,0,0.1)',
                    borderRadius: '50%',
                    width: '40px',
                    height: '40px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                    backdropFilter: 'blur(4px)',
                    color: '#2c3e50',
                    transition: 'transform 0.2s',
                    padding: 0
                }}
                title={isPlaying ? "Pausar música" : "Reproducir música"}
            >
                {isPlaying ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                )}
            </button>
        </div>
    )
}
