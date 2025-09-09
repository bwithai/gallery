import { Image, ImageProps } from "@chakra-ui/react"
import { useState, useEffect } from "react"

interface AuthenticatedImageProps extends Omit<ImageProps, 'src'> {
  src: string
  fallback?: React.ReactElement
}

export function AuthenticatedImage({ src, fallback, ...props }: AuthenticatedImageProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [error, setError] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    const fetchImage = async () => {
      try {
        setLoading(true)
        setError(false)
        
        const token = localStorage.getItem("access_token")
        if (!token) {
          setError(true)
          setLoading(false)
          return
        }

        const response = await fetch(src, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        setImageSrc(url)
        setLoading(false)
      } catch (err) {
        console.error('Error fetching authenticated image:', err)
        setError(true)
        setLoading(false)
      }
    }

    fetchImage()

    // Cleanup function to revoke object URL
    return () => {
      if (imageSrc) {
        URL.revokeObjectURL(imageSrc)
      }
    }
  }, [src])

  if (loading) {
    return fallback || null
  }

  if (error || !imageSrc) {
    return fallback || null
  }

  return <Image src={imageSrc} {...props} />
}
