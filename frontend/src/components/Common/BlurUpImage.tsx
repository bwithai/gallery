import { Image, ImageProps, Box } from "@chakra-ui/react"
import { useState, useEffect } from "react"

interface BlurUpImageProps extends Omit<ImageProps, 'src'> {
  src: string
  fallback?: React.ReactElement
  blurDataURL?: string // Optional low-res placeholder
}

export function BlurUpImage({ src, fallback, blurDataURL, ...props }: BlurUpImageProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [error, setError] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(true)
  const [imageLoaded, setImageLoaded] = useState<boolean>(false)

  // Generate a simple blur placeholder if none provided
  const defaultBlurDataURL = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIHZpZXdCb3g9IjAgMCAxMCAxMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSIjZjNmNGY2Ii8+Cjwvc3ZnPgo="

  useEffect(() => {
    const fetchImage = async () => {
      try {
        setLoading(true)
        setError(false)
        setImageLoaded(false)
        
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

  const handleImageLoad = () => {
    setImageLoaded(true)
  }

  if (loading) {
    // Show blur placeholder while loading
    return (
      <Box position="relative" overflow="hidden" {...props}>
        <Image
          src={blurDataURL || defaultBlurDataURL}
          filter="blur(20px)"
          transform="scale(1.1)"
          transition="all 0.3s ease-out"
          {...props}
        />
        {/* Subtle loading animation overlay */}
        <Box
          position="absolute"
          inset="0"
          bg="linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.1) 50%, transparent 70%)"
          animation="shimmer 2s infinite"
          css={{
            '@keyframes shimmer': {
              '0%': { transform: 'translateX(-100%)' },
              '100%': { transform: 'translateX(100%)' }
            }
          }}
        />
      </Box>
    )
  }

  if (error || !imageSrc) {
    return fallback || null
  }

  return (
    <Box position="relative" overflow="hidden" {...props}>
      {/* Blur placeholder that fades out */}
      <Image
        src={blurDataURL || defaultBlurDataURL}
        position="absolute"
        inset="0"
        filter="blur(20px)"
        transform="scale(1.1)" // Slightly scale up to hide blur edges
        transition="opacity 0.3s ease-out"
        opacity={imageLoaded ? 0 : 1}
        {...props}
      />
      
      {/* Main image that fades in */}
      <Image
        src={imageSrc}
        onLoad={handleImageLoad}
        transition="all 0.3s ease-out"
        opacity={imageLoaded ? 1 : 0}
        transform={imageLoaded ? "scale(1)" : "scale(1.02)"}
        {...props}
      />
    </Box>
  )
}
