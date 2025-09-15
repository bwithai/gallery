import {
  Box,
  Container,
  EmptyState,
  Flex,
  Heading,
  Text,
  VStack,
  Button,
  HStack,
} from "@chakra-ui/react"
import { useState, useEffect, useMemo } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { FiImage, FiBookmark, FiShare2, FiMaximize2, FiX, FiChevronLeft, FiChevronRight, FiArrowLeft, FiArrowRight } from "react-icons/fi"
import { z } from "zod"

import { ItemsService } from "@/client"
import { ItemActionsMenu } from "@/components/Common/ItemActionsMenu"
import { BlurUpImage } from "@/components/Common/BlurUpImage"
import PendingItems from "@/components/Pending/PendingItems"
import {
  DialogContent,
  DialogRoot,
} from "@/components/ui/dialog"
import styles from "../Item.module.css"
import Masonry from "react-masonry-css"

const itemsSearchSchema = z.object({
  page: z.number().catch(1),
})

const PER_PAGE = 50 // Show 50 images per page for better user experience

function getItemsQueryOptions(page: number) {
  return {
    queryFn: () => ItemsService.readItems({ 
      skip: (page - 1) * PER_PAGE, 
      limit: PER_PAGE 
    }),
    queryKey: ["items", page],
    staleTime: 5 * 60 * 1000, // 5 minutes
  }
}

export const Route = createFileRoute("/_layout/")({
  component: Items,
  validateSearch: (search) => itemsSearchSchema.parse(search),
})

function ImageGallery({ selectedItem, setSelectedItem, page, setPage }: { 
  selectedItem: any, 
  setSelectedItem: (item: any) => void,
  page: number,
  setPage: (page: number) => void
}) {
  const queryClient = useQueryClient()

  const {
    data,
    isLoading,
    isError,
  } = useQuery(getItemsQueryOptions(page))

  const items = data?.data ?? []
  const totalCount = data?.count ?? 0
  const totalPages = Math.ceil(totalCount / PER_PAGE)

  const handleImageClick = (item: any) => {
    setSelectedItem(item)
    // Scroll to the image details section
    setTimeout(() => {
      const detailsSection = document.getElementById('image-details')
      if (detailsSection) {
        detailsSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
      } else {
        // Fallback: scroll to top if details section not found
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    }, 100) // Small delay to ensure the details section is rendered
  }

  // Listen for item deletion and clear selected item
  useEffect(() => {
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event?.type === 'updated' && event.query.queryKey[0] === 'items') {
        // Check if selected item still exists in the updated data
        const updatedData = event.query.state.data as any
        if (selectedItem && updatedData?.data) {
          const itemExists = updatedData.data.some((item: any) => item.id === selectedItem.id)
          if (!itemExists) {
            // Item was deleted, clear selected item
            setSelectedItem(null)
          }
        }
      }
    })

    return unsubscribe
  }, [queryClient, selectedItem])

  // Optimized masonry breakpoints for smoother performance and better UX
  const breakpoints = {
    default: 5, // More columns for desktop - users want to see more images
    1600: 4,    // Large screens
    1200: 3,    // Medium screens  
    768: 2,     // Tablets
    480: 1,     // Mobile
  }

  if (isLoading) {
    return <PendingItems />
  }

  if (isError) {
    return (
      <EmptyState.Root>
        <EmptyState.Content>
          <EmptyState.Indicator>
            <FiImage size="48" />
          </EmptyState.Indicator>
          <VStack textAlign="center">
            <EmptyState.Title>Error loading images</EmptyState.Title>
            <EmptyState.Description>
              Something went wrong. Please try refreshing the page.
            </EmptyState.Description>
            <Button onClick={() => window.location.reload()} colorScheme="blue" size="sm">
              Refresh Page
            </Button>
          </VStack>
        </EmptyState.Content>
      </EmptyState.Root>
    )
  }

  if (items.length === 0) {
    return (
      <EmptyState.Root>
        <EmptyState.Content>
          <EmptyState.Indicator>
            <FiImage size="48" />
          </EmptyState.Indicator>
          <VStack textAlign="center">
            <EmptyState.Title>No images in your gallery yet</EmptyState.Title>
            <EmptyState.Description>
              Upload your first image to get started
            </EmptyState.Description>
          </VStack>
        </EmptyState.Content>
      </EmptyState.Root>
    )
  }

  return (
    <>
      {/* Page Info */}
      <Flex justify="space-between" align="center" mb={6}>
        <Text fontSize="sm" color="gray.600">
          Showing {((page - 1) * PER_PAGE) + 1}-{Math.min(page * PER_PAGE, totalCount)} of {totalCount} images
        </Text>
        <Text fontSize="sm" color="gray.500">
          Page {page} of {totalPages}
        </Text>
      </Flex>
        {/* True masonry layout with react-masonry-css */}
        <Masonry
          breakpointCols={breakpoints}
          className={styles.masonryGrid}
          columnClassName={styles.masonryColumn}
        >
          {items.map((item) => {
            // Let the masonry handle natural sizing - no fixed heights
          return (
            <Box
              key={item.id}
              borderRadius="2xl"
              overflow="hidden"
              mb={4} // Reduced spacing for more compact layout
              transition="all 0.2s ease" // Faster transition for snappier feel
              cursor="pointer"
              shadow="md"
              position="relative"
              _hover={{ 
                transform: "scale(1.02)", // Smaller scale for less jarring effect
                shadow: "lg",
                "& .pinterest-overlay": {
                  opacity: 1
                }
              }}
              onClick={() => handleImageClick(item)}
            >
                <BlurUpImage
                src={`/api/v1/items/${item.id}/image`}
                alt={item.alt_text || item.title}
                objectFit="cover"
                w="full"
                  // Let image maintain natural aspect ratio
                borderRadius="2xl"
                  loading="lazy"
                fallback={
                  <Box
                    bg="gray.200"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    w="full"
                      minH="200px"
                    borderRadius="2xl"
                  >
                    <FiImage size="64" color="gray.400" />
                  </Box>
                }
              />
              
                {/* Pinterest-like hover overlay */}
              <Box
                  className="pinterest-overlay"
                position="absolute"
                  inset="0"
                  bg="rgba(0,0,0,0.25)"
                opacity={0}
                  transition="opacity 0.3s ease"
                  display="flex"
                  flexDirection="column"
                  justifyContent="space-between"
                  p={4}
                  borderRadius="2xl"
                >
                  {/* Top section with action buttons */}
                  <HStack justify="flex-end" gap={2}>
                    <Button
                      size="sm"
                      colorScheme="red"
                      borderRadius="full"
                      shadow="lg"
                      onClick={(e) => {
                        e.stopPropagation()
                        // TODO: Implement save functionality
                        console.log('Save item:', item.id)
                      }}
                    >
                      <FiBookmark style={{ marginRight: '4px' }} />
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="solid"
                      bg="white"
                      color="gray.700"
                      borderRadius="full"
                      shadow="lg"
                      onClick={(e) => {
                        e.stopPropagation()
                        // TODO: Implement share functionality
                        console.log('Share item:', item.id)
                      }}
                    >
                      <FiShare2 />
                    </Button>
                  </HStack>

                  {/* Bottom section with item info and menu */}
                  <HStack justify="space-between" align="flex-end">
                    <VStack align="start" gap={1} flex={1}>
                      <Text
                        color="white"
                        fontSize="sm"
                        fontWeight="bold"
                        textShadow="0 1px 2px rgba(0,0,0,0.7)"
                        css={{
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden'
                        }}
                      >
                        {item.title}
                      </Text>
                      {item.description && (
                        <Text
                          color="white"
                          fontSize="xs"
                          opacity={0.9}
                          textShadow="0 1px 2px rgba(0,0,0,0.7)"
                          css={{
                            display: '-webkit-box',
                            WebkitLineClamp: 1,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden'
                          }}
                        >
                          {item.description}
                        </Text>
                      )}
                    </VStack>
                    
                    {/* More actions menu */}
                    <Box
                bg="white"
                borderRadius="full"
                shadow="lg"
                p={1}
                onClick={(e) => {
                        e.stopPropagation()
                }}
              >
                <ItemActionsMenu item={item} inModal={false} />
                    </Box>
                  </HStack>
              </Box>
            </Box>
          )
        })}
        </Masonry>
      
      {/* Pagination Controls */}
      {totalPages > 1 && (
        <Flex justify="center" align="center" mt={12} mb={8}>
          <HStack gap={4}>
            {/* Previous Page Button */}
            <Button
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
              variant="outline"
              size="md"
            >
              <FiArrowLeft style={{ marginRight: '8px' }} />
              Previous
            </Button>
            
            {/* Page Numbers */}
            <HStack gap={2}>
              {/* First page */}
              {page > 3 && (
                <>
                  <Button
                    size="sm"
                    variant={1 === page ? "solid" : "ghost"}
                    onClick={() => setPage(1)}
                  >
                    1
                  </Button>
                  {page > 4 && <Text color="gray.400">...</Text>}
                </>
              )}
              
              {/* Pages around current page */}
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNum = Math.max(1, Math.min(totalPages - 4, page - 2)) + i
                if (pageNum > totalPages) return null
                
                return (
                  <Button
                    key={pageNum}
                    size="sm"
                    variant={pageNum === page ? "solid" : "ghost"}
                    onClick={() => setPage(pageNum)}
                    colorScheme={pageNum === page ? "blue" : "gray"}
                  >
                    {pageNum}
                  </Button>
                )
              })}
              
              {/* Last page */}
              {page < totalPages - 2 && (
                <>
                  {page < totalPages - 3 && <Text color="gray.400">...</Text>}
                  <Button
                    size="sm"
                    variant={totalPages === page ? "solid" : "ghost"}
                    onClick={() => setPage(totalPages)}
                  >
                    {totalPages}
                  </Button>
                </>
              )}
            </HStack>
            
            {/* Next Page Button */}
            <Button
              onClick={() => setPage(page + 1)}
              disabled={page === totalPages}
              variant="outline"
              size="md"
            >
              Next
              <FiArrowRight style={{ marginLeft: '8px' }} />
            </Button>
          </HStack>
        </Flex>
      )}
    </>
  )
}

function InlineImageDetails({ selectedItem, setSelectedItem }: { selectedItem: any, setSelectedItem: (item: any) => void }) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [fullscreenItem, setFullscreenItem] = useState<any>(null)

  // Fetch ALL related items from the same collection
  const { data: relatedData } = useQuery({
    queryKey: ["related-items", selectedItem?.collection_id],
    queryFn: () => selectedItem ? ItemsService.readItems({ 
      skip: 0, 
      limit: 1000, // Get all images in collection
      collectionId: selectedItem.collection_id 
    }) : null,
    enabled: !!selectedItem?.collection_id,
  })

  // Split related images into two groups for Pinterest-style layout
  const { rightSideImages, bottomImages } = useMemo(() => {
    if (!relatedData?.data) return { rightSideImages: [], bottomImages: [] }
    
    const filteredRelated = relatedData.data.filter(item => item.id !== selectedItem?.id)
    const rightSideCount = 4 // Show 4 images on the right side
    
    // Randomly select 4 images for right side
    const shuffled = [...filteredRelated].sort(() => Math.random() - 0.5)
    return {
      rightSideImages: shuffled.slice(0, rightSideCount),
      bottomImages: shuffled.slice(rightSideCount) // Rest go to bottom
    }
  }, [relatedData, selectedItem])

  const handleFullscreenOpen = (item: any) => {
    setFullscreenItem(item)
    setIsFullscreen(true)
  }

  const handleFullscreenClose = () => {
    setIsFullscreen(false)
    setFullscreenItem(null)
  }

  // Navigation in fullscreen
  const handleFullscreenNext = () => {
    if (!fullscreenItem || !relatedData?.data) return
    
    const currentIndex = relatedData.data.findIndex(item => item.id === fullscreenItem.id)
    const nextIndex = (currentIndex + 1) % relatedData.data.length
    setFullscreenItem(relatedData.data[nextIndex])
  }

  const handleFullscreenPrev = () => {
    if (!fullscreenItem || !relatedData?.data) return
    
    const currentIndex = relatedData.data.findIndex(item => item.id === fullscreenItem.id)
    const prevIndex = currentIndex === 0 ? relatedData.data.length - 1 : currentIndex - 1
    setFullscreenItem(relatedData.data[prevIndex])
  }

  // Keyboard navigation for fullscreen
  useEffect(() => {
    if (!isFullscreen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          handleFullscreenClose()
          break
        case 'ArrowLeft':
          handleFullscreenPrev()
          break
        case 'ArrowRight':
          handleFullscreenNext()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isFullscreen, fullscreenItem, relatedData])

  if (!selectedItem) return null

  return (
    <>
      {/* Inline Image Details Section */}
      <Box id="image-details" mb={8} bg="gray.50" borderRadius="2xl" p={6}>
        <Container maxW="8xl">
          {/* Close button for inline view */}
          <Flex justify="space-between" align="center" mb={6}>
            <Heading size="md" color="gray.700">
              Image Details
            </Heading>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedItem(null)}
              borderRadius="full"
            >
              <FiX size="20" />
              Close Details
            </Button>
          </Flex>

          {/* Pinterest-style layout with main image on left, related on right */}
          <Flex 
            direction={{ base: "column", lg: "row" }} 
            gap={8} 
            mb={12}
            align="flex-start"
          >
            {/* Main image - Left side (about half screen) */}
            <Box
              flex={{ base: "1", lg: "1 1 48%" }}
              maxW={{ base: "full", lg: "48%" }}
            >
              <Box
                key={`main-${selectedItem.id}`}
                bg="white"
                borderRadius="3xl"
                overflow="hidden"
                shadow="2xl"
                border="4px solid"
                borderColor="blue.400"
                position="relative"
                w="full"
              >
                {/* Large main image */}
                <BlurUpImage
                  src={`/api/v1/items/${selectedItem.id}/image`}
                  alt={selectedItem.alt_text || selectedItem.title}
                  objectFit="cover"
                  w="full"
                  borderRadius="2xl"
                  fallback={
                    <Box
                      bg="gray.200"
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      w="full"
                      minH="500px"
                      borderRadius="2xl"
                    >
                      <FiImage size="96" color="gray.400" />
                    </Box>
                  }
                />
                
                {/* Pinterest-style overlay with details */}
                <Box
                  position="absolute"
                  bottom="0"
                  left="0"
                  right="0"
                  bg="linear-gradient(transparent, rgba(0,0,0,0.85))"
                  p={6}
                  color="white"
                >
                  <Heading size="lg" mb={3} textShadow="0 2px 4px rgba(0,0,0,0.7)">
                    {selectedItem.title}
                  </Heading>
                  {selectedItem.description && (
                    <Text 
                      fontSize="md" 
                      mb={4} 
                      textShadow="0 1px 3px rgba(0,0,0,0.7)"
                      lineHeight="1.5"
                      css={{
                        display: '-webkit-box',
                        WebkitLineClamp: 4,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}
                    >
                      {selectedItem.description}
                    </Text>
                  )}
                  <Flex gap={6} fontSize="sm" opacity={0.95} wrap="wrap">
                    <Text fontWeight="medium">{selectedItem.width} × {selectedItem.height}</Text>
                    <Text fontWeight="medium">{selectedItem.mime_type}</Text>
                    <Text fontWeight="medium">{new Date(selectedItem.upload_date).toLocaleDateString()}</Text>
                  </Flex>
                </Box>

                {/* "Currently Viewing" badge */}
                <Box
                  position="absolute"
                  top="4"
                  left="4"
                  bg="blue.500"
                  color="white"
                  px={4}
                  py={2}
                  borderRadius="full"
                  fontSize="sm"
                  fontWeight="bold"
                  textTransform="uppercase"
                  letterSpacing="wide"
                  shadow="lg"
                >
                  Now Viewing
                </Box>

                {/* Action Menu and Fullscreen Button */}
                <HStack
                  position="absolute"
                  top="4"
                  right="4"
                  gap={2}
                >
                  {/* View Full Image Button */}
                  <Button
                    size="sm"
                    bg="white"
                    color="gray.700"
                    borderRadius="full"
                    shadow="xl"
                    onClick={() => handleFullscreenOpen(selectedItem)}
                  >
                    <FiMaximize2 style={{ marginRight: '6px' }} />
                    View Full Image
                  </Button>
                  
                  {/* Action Menu */}
                  <Box
                    bg="white"
                    borderRadius="full"
                    shadow="xl"
                    p={2}
                  >
                    <ItemActionsMenu item={selectedItem} inModal={true} />
                  </Box>
                </HStack>
              </Box>
            </Box>

            {/* Right side: "More like this" section */}
            {rightSideImages.length > 0 && (
              <Box flex={{ base: "1", lg: "1 1 48%" }} maxW={{ base: "full", lg: "48%" }}>
                <VStack align="start" gap={6}>
                  <Heading size="md" color="gray.700">
                    More like this
                  </Heading>
                  
                  {/* Right-side related images - smaller grid */}
                  <Masonry
                    breakpointCols={{
                      default: 2, // 2 columns on right side
                      768: 2,
                      480: 1,
                    }}
                    className={styles.masonryGrid}
                    columnClassName={styles.masonryColumn}
                  >
                    {rightSideImages.map((relatedItem) => (
                        <Box
                          key={`right-${relatedItem.id}`}
                          borderRadius="2xl"
                          overflow="hidden"
                          mb={6}
                          cursor="pointer"
                          transition="all 0.3s ease"
                          shadow="md"
                          position="relative"
                          _hover={{ 
                            transform: "scale(1.04)",
                            shadow: "lg",
                            "& .pinterest-overlay": {
                              opacity: 1
                            }
                          }}
                          onClick={() => setSelectedItem(relatedItem)}
                          onDoubleClick={() => handleFullscreenOpen(relatedItem)}
                        >
                          <BlurUpImage
                            src={`/api/v1/items/${relatedItem.id}/image`}
                            alt={relatedItem.alt_text || relatedItem.title}
                            objectFit="cover"
                            w="full"
                            loading="lazy"
                            fallback={
                              <Box
                                bg="gray.200"
                                display="flex"
                                alignItems="center"
                                justifyContent="center"
                                w="full"
                                minH="200px"
                                borderRadius="2xl"
                              >
                                <FiImage size="48" color="gray.400" />
                              </Box>
                            }
                          />
                          
                          {/* Pinterest-style hover overlay */}
                          <Box
                            className="pinterest-overlay"
                            position="absolute"
                            inset="0"
                            bg="rgba(0,0,0,0.25)"
                            opacity={0}
                            transition="opacity 0.3s ease"
                            display="flex"
                            flexDirection="column"
                            justifyContent="space-between"
                            p={3}
                            borderRadius="2xl"
                          >
                            {/* Top section with action buttons */}
                            <HStack justify="flex-end" gap={2}>
                              <Button
                                size="xs"
                                colorScheme="red"
                                borderRadius="full"
                                shadow="lg"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  console.log('Save related item:', relatedItem.id)
                                }}
                              >
                                <FiBookmark style={{ marginRight: '2px' }} />
                                Save
                              </Button>
                              <Button
                                size="xs"
                                variant="solid"
                                bg="white"
                                color="gray.700"
                                borderRadius="full"
                                shadow="lg"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleFullscreenOpen(relatedItem)
                                }}
                              >
                                <FiMaximize2 />
                              </Button>
                            </HStack>

                            {/* Bottom section with item info */}
                            <VStack align="start" gap={0}>
                              <Text
                                color="white"
                                fontSize="xs"
                                fontWeight="bold"
                                textShadow="0 1px 2px rgba(0,0,0,0.7)"
                                css={{
                                  display: '-webkit-box',
                                  WebkitLineClamp: 1,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden'
                                }}
                              >
                                {relatedItem.title}
                              </Text>
                            </VStack>
                          </Box>
                        </Box>
                      ))}
                  </Masonry>
                </VStack>
              </Box>
            )}
          </Flex>

          {/* Bottom section: "More ideas" spanning full width */}
          {bottomImages.length > 0 && (
            <Box w="full">
              <VStack align="start" gap={6}>
                <Heading size="md" color="gray.700">
                  More from this collection
                </Heading>
                
                {/* Full-width masonry grid */}
                <Masonry
                  breakpointCols={{
                    default: 4,
                    1600: 3,
                    1200: 3,
                    768: 2,
                    480: 1,
                  }}
                  className={styles.masonryGrid}
                  columnClassName={styles.masonryColumn}
                >
                  {bottomImages.map((relatedItem) => (
                      <Box
                        key={`bottom-${relatedItem.id}`}
                        borderRadius="2xl"
                        overflow="hidden"
                        mb={8}
                        cursor="pointer"
                        transition="all 0.3s ease"
                        shadow="md"
                        position="relative"
                        _hover={{ 
                          transform: "scale(1.04)",
                          shadow: "lg",
                          "& .pinterest-overlay": {
                            opacity: 1
                          }
                        }}
                        onClick={() => setSelectedItem(relatedItem)}
                        onDoubleClick={() => handleFullscreenOpen(relatedItem)}
                      >
                        <BlurUpImage
                          src={`/api/v1/items/${relatedItem.id}/image`}
                          alt={relatedItem.alt_text || relatedItem.title}
                          objectFit="cover"
                          w="full"
                          loading="lazy"
                          fallback={
                            <Box
                              bg="gray.200"
                              display="flex"
                              alignItems="center"
                              justifyContent="center"
                              w="full"
                              minH="250px"
                              borderRadius="2xl"
                            >
                              <FiImage size="64" color="gray.400" />
                            </Box>
                          }
                        />
                        
                        {/* Pinterest-style hover overlay */}
                        <Box
                          className="pinterest-overlay"
                          position="absolute"
                          inset="0"
                          bg="rgba(0,0,0,0.25)"
                          opacity={0}
                          transition="opacity 0.3s ease"
                          display="flex"
                          flexDirection="column"
                          justifyContent="space-between"
                          p={4}
                          borderRadius="2xl"
                        >
                          {/* Top section with action buttons */}
                          <HStack justify="flex-end" gap={2}>
                            <Button
                              size="xs"
                              colorScheme="red"
                              borderRadius="full"
                              shadow="lg"
                              onClick={(e) => {
                                e.stopPropagation()
                                console.log('Save related item:', relatedItem.id)
                              }}
                            >
                              <FiBookmark style={{ marginRight: '2px' }} />
                              Save
                            </Button>
                            <Button
                              size="xs"
                              variant="solid"
                              bg="white"
                              color="gray.700"
                              borderRadius="full"
                              shadow="lg"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleFullscreenOpen(relatedItem)
                              }}
                            >
                              <FiMaximize2 />
                            </Button>
                            <Button
                              size="xs"
                              variant="solid"
                              bg="white"
                              color="gray.700"
                              borderRadius="full"
                              shadow="lg"
                              onClick={(e) => {
                                e.stopPropagation()
                                console.log('Share related item:', relatedItem.id)
                              }}
                            >
                              <FiShare2 />
                            </Button>
                          </HStack>

                          {/* Bottom section with item info and menu */}
                          <HStack justify="space-between" align="flex-end">
                            <VStack align="start" gap={0} flex={1}>
                              <Text
                                color="white"
                                fontSize="xs"
                                fontWeight="bold"
                                textShadow="0 1px 2px rgba(0,0,0,0.7)"
                                css={{
                                  display: '-webkit-box',
                                  WebkitLineClamp: 1,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden'
                                }}
                              >
                                {relatedItem.title}
                              </Text>
                              {relatedItem.description && (
                                <Text
                                  color="white"
                                  fontSize="2xs"
                                  opacity={0.9}
                                  textShadow="0 1px 2px rgba(0,0,0,0.7)"
                                  css={{
                                    display: '-webkit-box',
                                    WebkitLineClamp: 1,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden'
                                  }}
                                >
                                  {relatedItem.description}
                                </Text>
                              )}
                            </VStack>
                            
                            {/* More actions menu */}
                            <Box
                              bg="white"
                              borderRadius="full"
                              shadow="lg"
                              p={1}
                              onClick={(e) => {
                                e.stopPropagation()
                              }}
                              onMouseDown={(e) => {
                                e.stopPropagation()
                              }}
                              onPointerDown={(e) => {
                                e.stopPropagation()
                              }}
                            >
                              <ItemActionsMenu item={relatedItem} inModal={true} />
                            </Box>
                          </HStack>
                        </Box>
                      </Box>
                    ))}
                </Masonry>
              </VStack>
            </Box>
          )}

          {/* Show message if no related images */}
          {rightSideImages.length === 0 && bottomImages.length === 0 && (
            <Box
              bg="white"
              borderRadius="2xl"
              p={8}
              textAlign="center"
            >
              <VStack>
                <Text color="gray.500" fontSize="md">
                  No other images in this collection
                </Text>
                <Text color="gray.400" fontSize="sm">
                  This is the only image in this collection
                </Text>
              </VStack>
            </Box>
          )}
        </Container>
      </Box>

      {/* Fullscreen Image Dialog */}
      <DialogRoot 
        open={isFullscreen} 
        onOpenChange={({ open }) => !open && handleFullscreenClose()}
        size="full"
        placement="center"
      >
        <DialogContent 
          maxW="100vw" 
          maxH="100vh" 
          bg="black" 
          borderRadius="0"
          p={0}
          overflow="hidden"
        >
          {fullscreenItem && (
            <Box 
              position="relative" 
              w="100vw" 
              h="100vh" 
              display="flex"
              alignItems="center"
              justifyContent="center"
              bg="black"
            >
              {/* Close button */}
              <Button
                position="fixed"
                top="6"
                right="6"
                bg="rgba(255,255,255,0.9)"
                color="gray.700"
                borderRadius="full"
                shadow="xl"
                size="lg"
                zIndex="overlay"
                onClick={handleFullscreenClose}
                _hover={{ bg: "white" }}
              >
                <FiX size="24" />
              </Button>

              {/* Navigation buttons */}
              {relatedData?.data && relatedData.data.length > 1 && (
                <>
                  <Button
                    position="fixed"
                    left="6"
                    top="50%"
                    transform="translateY(-50%)"
                    bg="rgba(255,255,255,0.9)"
                    color="gray.700"
                    borderRadius="full"
                    shadow="xl"
                    size="lg"
                    zIndex="overlay"
                    onClick={handleFullscreenPrev}
                    _hover={{ bg: "white" }}
                  >
                    <FiChevronLeft size="24" />
                  </Button>
                  
                  <Button
                    position="fixed"
                    right="6"
                    top="50%"
                    transform="translateY(-50%)"
                    bg="rgba(255,255,255,0.9)"
                    color="gray.700"
                    borderRadius="full"
                    shadow="xl"
                    size="lg"
                    zIndex="overlay"
                    onClick={handleFullscreenNext}
                    _hover={{ bg: "white" }}
                  >
                    <FiChevronRight size="24" />
                  </Button>
                </>
              )}

              {/* Full-size image */}
              <BlurUpImage
                src={`/api/v1/items/${fullscreenItem.id}/image`}
                alt={fullscreenItem.alt_text || fullscreenItem.title}
                objectFit="contain"
                maxW="100vw"
                maxH="100vh"
                w="auto"
                h="auto"
                fallback={
                  <Box
                    bg="gray.800"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    w="100vw"
                    h="100vh"
                  >
                    <VStack>
                      <FiImage size="96" color="gray.400" />
                      <Text color="gray.400">Failed to load image</Text>
                    </VStack>
                  </Box>
                }
              />

              {/* Image info overlay */}
              <Box
                position="fixed"
                bottom="0"
                left="0"
                right="0"
                bg="linear-gradient(transparent, rgba(0,0,0,0.8))"
                p={8}
                zIndex="overlay"
              >
                <Container maxW="4xl">
                  <VStack align="start" gap={3}>
                    <Heading size="lg" color="white" textShadow="0 2px 4px rgba(0,0,0,0.7)">
                      {fullscreenItem.title}
                    </Heading>
                    {fullscreenItem.description && (
                      <Text 
                        color="white" 
                        fontSize="md"
                        textShadow="0 1px 3px rgba(0,0,0,0.7)"
                        maxW="2xl"
                      >
                        {fullscreenItem.description}
                      </Text>
                    )}
                    <HStack gap={6} color="white" fontSize="sm" opacity={0.9}>
                      <Text fontWeight="medium">{fullscreenItem.width} × {fullscreenItem.height}</Text>
                      <Text fontWeight="medium">{fullscreenItem.mime_type}</Text>
                      <Text fontWeight="medium">{new Date(fullscreenItem.upload_date).toLocaleDateString()}</Text>
                    </HStack>
                  </VStack>
                </Container>
              </Box>

              {/* Action buttons */}
              <HStack
                position="fixed"
                top="6"
                left="6"
                gap={3}
                zIndex="overlay"
              >
                <Button
                  size="sm"
                  colorScheme="red"
                  borderRadius="full"
                  shadow="xl"
                  onClick={(e) => {
                    e.stopPropagation()
                    console.log('Save fullscreen item:', fullscreenItem.id)
                  }}
                >
                  <FiBookmark style={{ marginRight: '4px' }} />
                  Save
                </Button>
                <Button
                  size="sm"
                  bg="rgba(255,255,255,0.9)"
                  color="gray.700"
                  borderRadius="full"
                  shadow="xl"
                  onClick={(e) => {
                    e.stopPropagation()
                    console.log('Share fullscreen item:', fullscreenItem.id)
                  }}
                  _hover={{ bg: "white" }}
                >
                  <FiShare2 />
                </Button>
              </HStack>
            </Box>
          )}
        </DialogContent>
      </DialogRoot>
    </>
  )
}

function Items() {
  const { page } = Route.useSearch()
  const navigate = Route.useNavigate()
  const [selectedItem, setSelectedItem] = useState<any>(null)

  const setPage = (newPage: number) => {
    navigate({ search: { page: newPage } })
    // Scroll to top when page changes
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <Container maxW="full" px={{ base: 4, md: 6, lg: 8 }}> {/* Increased padding for better spacing */}
      <Heading size="lg" pt={12}>
        Gallery Dashboard
      </Heading>
      
      {/* Inline Image Details at the top */}
      <InlineImageDetails selectedItem={selectedItem} setSelectedItem={setSelectedItem} />
      
      {/* Main Image Gallery */}
      <ImageGallery 
        selectedItem={selectedItem} 
        setSelectedItem={setSelectedItem}
        page={page}
        setPage={setPage}
      />
    </Container>
  )
}
