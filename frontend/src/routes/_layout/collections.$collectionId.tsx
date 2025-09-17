import {
  Box,
  Container,
  EmptyState,
  Flex,
  Heading,
  Text,
  VStack,
  Spinner,
  Button,
  HStack,
} from "@chakra-ui/react"
import { useState, useEffect, useMemo } from "react"
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { FiImage, FiBookmark, FiShare2, FiMaximize2, FiX, FiChevronLeft, FiChevronRight } from "react-icons/fi"
import { z } from "zod"

import { ItemsService, CollectionsService } from "@/client"
import { ItemActionsMenu } from "@/components/Common/ItemActionsMenu"
import { BlurUpImage } from "@/components/Common/BlurUpImage"
import AddItem from "@/components/Items/AddItem"
import { useFavorites } from "@/hooks/useFavorites"
import {
  DialogContent,
  DialogRoot,
} from "@/components/ui/dialog"
import styles from "../Item.module.css"
import Masonry from "react-masonry-css"
import InfiniteScroll from "react-infinite-scroll-component"

const itemsSearchSchema = z.object({
  // Remove page since we're using infinite scroll
})

const PER_PAGE = 20

function getItemsInfiniteQueryOptions(collectionId: number) {
  return {
    queryFn: ({ pageParam = 0 }) =>
      ItemsService.readItems({ 
        skip: pageParam * PER_PAGE, 
        limit: PER_PAGE,
        collectionId: collectionId 
      }),
    queryKey: ["items", "collection", collectionId],
    initialPageParam: 0,
    getNextPageParam: (lastPage: any, allPages: any[]) => {
      const totalItems = allPages.reduce((acc, page) => acc + page.data.length, 0)
      return totalItems < lastPage.count ? allPages.length : undefined
    },
  }
}

export const Route = createFileRoute("/_layout/collections/$collectionId")({
  component: CollectionItems,
  validateSearch: (search) => itemsSearchSchema.parse(search),
})

function CollectionItems() {
  const { collectionId } = Route.useParams()
  const collectionIdNum = parseInt(collectionId, 10)

  // Fetch collection details
  const { data: collection, isLoading: isCollectionLoading } = useQuery({
    queryKey: ["collection", collectionIdNum],
    queryFn: () => CollectionsService.readCollection({ id: collectionIdNum }),
  })

  return (
    <Container maxW="full" px={{ base: 4, md: 6, lg: 8 }}>
      {/* Collection Header */}
      <Flex justify="space-between" align="flex-start" pt={12} pb={6}>
        <VStack align="start" gap={4}>
          {isCollectionLoading ? (
            <Spinner size="sm" />
          ) : (
            <>
              <Heading size="lg" color="ui.main">
                {collection?.name}
              </Heading>
              {collection?.description && (
                <Text color="gray.600" fontSize="md">
                  {collection.description}
                </Text>
              )}
            </>
          )}
        </VStack>
        
        {/* Add Item Button - Moved to right side */}
        <Box pt={2}>
          <AddItem collectionId={collectionIdNum} />
        </Box>
      </Flex>

      {/* Items Gallery */}
      <ImageGallery collectionId={collectionIdNum} />
    </Container>
  )
}

function InlineImageDetails({ selectedItem, setSelectedItem, allCollectionImages, currentImageIndex, handlePrevImage, handleNextImage, handleFullscreenOpen }: { 
  selectedItem: any, 
  setSelectedItem: (item: any) => void,
  allCollectionImages: any[],
  currentImageIndex: number,
  handlePrevImage: () => void,
  handleNextImage: () => void,
  handleFullscreenOpen: (item: any) => void
}) {
  const { saveItemMutation, isItemInFavorites, isLoading: isSavingItem } = useFavorites()
  
  // Fetch collection information
  const { data: collection } = useQuery({
    queryKey: ["collection", selectedItem?.collection_id],
    queryFn: () => selectedItem ? CollectionsService.readCollection({ id: selectedItem.collection_id }) : null,
    enabled: !!selectedItem?.collection_id,
  })

  // Split related images for bottom section (exclude current image)
  const relatedImages = useMemo(() => {
    if (!allCollectionImages || !selectedItem) return []
    return allCollectionImages.filter(item => item.id !== selectedItem.id)
  }, [allCollectionImages, selectedItem])

  if (!selectedItem) return null

  return (
    <>
      {/* Inline Image Details Section */}
      <Box id="image-details" mb={8} bg="gray.50" borderRadius="2xl" p={6}>
        <Container maxW="8xl">
          {/* Close button for inline view */}
          <Flex justify="space-between" align="center" mb={6}>
            <Heading size="md" color="gray.700">
              {collection?.name || 'Loading...'}
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

          {/* Upper section - Full width with image and navigation */}
          <Box mb={8}>
                <Flex 
                  direction={{ base: "column", lg: "row" }} 
                  gap={8} 
                  align="flex-start"
                >
              {/* Main image section - Left side */}
                  <Box
                flex={{ base: "1", lg: "1 1 60%" }}
                maxW={{ base: "full", lg: "60%" }}
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

                {/* Navigation buttons */}
                {allCollectionImages.length > 1 && (
                  <>
                    <Button
                      position="absolute"
                      left="4"
                      top="50%"
                      transform="translateY(-50%)"
                      bg="rgba(255,255,255,0.9)"
                      color="gray.700"
                      borderRadius="full"
                      shadow="xl"
                      size="md"
                      onClick={handlePrevImage}
                      _hover={{ bg: "white" }}
                    >
                      <FiChevronLeft size="20" />
                    </Button>
                    
                    <Button
                      position="absolute"
                      right="4"
                      top="50%"
                      transform="translateY(-50%)"
                      bg="rgba(255,255,255,0.9)"
                      color="gray.700"
                      borderRadius="full"
                      shadow="xl"
                      size="md"
                      onClick={handleNextImage}
                      _hover={{ bg: "white" }}
                    >
                      <FiChevronRight size="20" />
                    </Button>
                  </>
                )}

                {/* Image counter badge */}
                      <Box
                        position="absolute"
                        top="4"
                        left="4"
                  bg="rgba(0,0,0,0.7)"
                        color="white"
                  px={3}
                  py={1}
                        borderRadius="full"
                        fontSize="sm"
                  fontWeight="medium"
                        shadow="lg"
                      >
                  {currentImageIndex + 1} of {allCollectionImages.length}
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

              {/* Image Details - Right side */}
              <Box
                flex={{ base: "1", lg: "1 1 35%" }}
                maxW={{ base: "full", lg: "35%" }}
                bg="white"
                borderRadius="2xl"
                p={6}
                shadow="lg"
                maxH={{ base: "none", lg: "50vh" }}
                overflowY="auto"
                css={{
                  '&::-webkit-scrollbar': {
                    width: '6px',
                  },
                  '&::-webkit-scrollbar-track': {
                    background: '#f1f1f1',
                    borderRadius: '3px',
                  },
                  '&::-webkit-scrollbar-thumb': {
                    background: '#c1c1c1',
                    borderRadius: '3px',
                  },
                  '&::-webkit-scrollbar-thumb:hover': {
                    background: '#a8a8a8',
                  },
                }}
              >
                <VStack align="start" gap={4}>
                  <Heading size="lg" color="gray.800">
                    {selectedItem.title}
                  </Heading>
                  
                  {selectedItem.description && (
                    <Text 
                      fontSize="md" 
                      color="gray.600"
                      lineHeight="1.6"
                    >
                      {selectedItem.description}
                    </Text>
                  )}
                  
                  {/* Image metadata */}
                  <VStack align="start" gap={4} w="full">
                    <Text fontSize="sm" fontWeight="semibold" color="gray.700">
                      Image Details
                    </Text>
                    
                    {/* Basic Information */}
                    <Box bg="gray.50" p={4} borderRadius="xl" w="full">
                      <VStack align="start" gap={2}>
                        <Text fontSize="xs" fontWeight="bold" color="gray.500" textTransform="uppercase" letterSpacing="wide">
                          Basic Information
                        </Text>
                        
                        {selectedItem.veneration && (
                          <Flex justify="space-between" w="full">
                            <Text fontSize="sm" color="gray.600">Veneration:</Text>
                            <Text fontSize="sm" fontWeight="medium">{selectedItem.veneration}</Text>
                          </Flex>
                        )}
                        
                        {selectedItem.alt_text && (
                          <Flex justify="space-between" w="full">
                            <Text fontSize="sm" color="gray.600">Alt Text:</Text>
                            <Text fontSize="sm" fontWeight="medium" textAlign="right" maxW="60%">{selectedItem.alt_text}</Text>
                          </Flex>
                        )}
                        
                        {selectedItem.commission_date && (
                          <Flex justify="space-between" w="full">
                            <Text fontSize="sm" color="gray.600">Commission Date:</Text>
                            <Text fontSize="sm" fontWeight="medium">{new Date(selectedItem.commission_date).toLocaleDateString()}</Text>
                          </Flex>
                        )}
                        
                        {selectedItem.owned_since && (
                          <Flex justify="space-between" w="full">
                            <Text fontSize="sm" color="gray.600">Owned Since:</Text>
                            <Text fontSize="sm" fontWeight="medium">{new Date(selectedItem.owned_since).toLocaleDateString()}</Text>
                          </Flex>
                        )}
                        
                        {selectedItem.monitory_value && (
                          <Flex justify="space-between" w="full">
                            <Text fontSize="sm" color="gray.600">Monetary Value:</Text>
                            <Text fontSize="sm" fontWeight="medium" color="green.600">Rs. {selectedItem.monitory_value.toLocaleString()}</Text>
                          </Flex>
                        )}
                      </VStack>
                    </Box>

                    {/* Technical Information */}
                    <Box bg="gray.50" p={4} borderRadius="xl" w="full">
                      <VStack align="start" gap={2}>
                        <Text fontSize="xs" fontWeight="bold" color="gray.500" textTransform="uppercase" letterSpacing="wide">
                          Technical Details
                        </Text>
                        
                        {(selectedItem.width && selectedItem.height) && (
                          <Flex justify="space-between" w="full">
                            <Text fontSize="sm" color="gray.600">Dimensions:</Text>
                            <Text fontSize="sm" fontWeight="medium">{selectedItem.width} × {selectedItem.height} px</Text>
                          </Flex>
                        )}
                        
                        <Flex justify="space-between" w="full">
                          <Text fontSize="sm" color="gray.600">Format:</Text>
                          <Text fontSize="sm" fontWeight="medium">{selectedItem.mime_type}</Text>
                        </Flex>
                        
                        <Flex justify="space-between" w="full">
                          <Text fontSize="sm" color="gray.600">File Size:</Text>
                          <Text fontSize="sm" fontWeight="medium">{(selectedItem.file_size / 1024 / 1024).toFixed(2)} MB</Text>
                        </Flex>
                        
                        <Flex justify="space-between" w="full">
                          <Text fontSize="sm" color="gray.600">Filename:</Text>
                          <Text fontSize="sm" fontWeight="medium" textAlign="right" maxW="60%" css={{
                            wordBreak: 'break-all'
                          }}>{selectedItem.filename}</Text>
                        </Flex>
                        
                        <Flex justify="space-between" w="full">
                          <Text fontSize="sm" color="gray.600">Upload Date:</Text>
                          <Text fontSize="sm" fontWeight="medium">{new Date(selectedItem.upload_date).toLocaleString()}</Text>
                        </Flex>
                      </VStack>
                    </Box>
                  </VStack>
                  
                  {/* Action buttons */}
                  <HStack w="full" gap={3} pt={2}>
                    <Button
                      size="sm"
                      colorScheme={isItemInFavorites(selectedItem.collection_id) ? "gray" : "red"}
                      flex={1}
                      loading={isSavingItem}
                      onClick={() => {
                        saveItemMutation.mutate({
                          itemId: selectedItem.id,
                          isSaved: isItemInFavorites(selectedItem.collection_id)
                        })
                      }}
                    >
                      <FiBookmark style={{ marginRight: '6px' }} />
                      {isItemInFavorites(selectedItem.collection_id) ? "Saved" : "Save"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      flex={1}
                      onClick={() => console.log('Share item:', selectedItem.id)}
                    >
                      <FiShare2 style={{ marginRight: '6px' }} />
                      Share
                    </Button>
                  </HStack>
                </VStack>
              </Box>
            </Flex>
          </Box>

          {/* Bottom section: Related images from collection */}
          {relatedImages.length > 0 && (
            <Box w="full">
                      <VStack align="start" gap={6}>
                <Heading size="md" color="gray.700">
                  More from this collection ({relatedImages.length} images)
                        </Heading>
                        
                {/* Full-width masonry grid */}
                        <Masonry
                          breakpointCols={{
                    default: 5,
                    1600: 4,
                    1200: 3,
                            768: 2,
                            480: 1,
                          }}
                          className={styles.masonryGrid}
                          columnClassName={styles.masonryColumn}
                        >
                  {relatedImages.map((relatedItem) => (
                              <Box
                        key={`related-${relatedItem.id}`}
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
                          p={4}
                                  borderRadius="2xl"
                                >
                                  {/* Top section with action buttons */}
                                  <HStack justify="flex-end" gap={2}>
                                    <Button
                                      size="xs"
                                      colorScheme={isItemInFavorites(relatedItem.collection_id) ? "gray" : "red"}
                                      borderRadius="full"
                                      shadow="lg"
                                      loading={isSavingItem}
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        saveItemMutation.mutate({
                                          itemId: relatedItem.id,
                                          isSaved: isItemInFavorites(relatedItem.collection_id)
                                        })
                                      }}
                                    >
                                      <FiBookmark style={{ marginRight: '2px' }} />
                                      {isItemInFavorites(relatedItem.collection_id) ? "Saved" : "Save"}
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
          {relatedImages.length === 0 && (
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
    </>
  )
}

function ImageGallery({ collectionId }: { collectionId: number }) {
  const [selectedItem, setSelectedItem] = useState<any>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [fullscreenItem, setFullscreenItem] = useState<any>(null)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const queryClient = useQueryClient()
  const { saveItemMutation, isItemInFavorites, isLoading: isSavingItem } = useFavorites()

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isLoading,
    isError,
  } = useInfiniteQuery(getItemsInfiniteQueryOptions(collectionId))

  // Flatten all pages into a single array
  const items = useMemo(() => {
    return data?.pages.flatMap(page => page.data) ?? []
  }, [data])

  // Get all images in collection for navigation
  const allCollectionImages = useMemo(() => {
    return items || []
  }, [items])

  // Update current image index when selectedItem changes
  useEffect(() => {
    if (selectedItem && allCollectionImages.length > 0) {
      const index = allCollectionImages.findIndex(item => item.id === selectedItem.id)
      setCurrentImageIndex(index >= 0 ? index : 0)
    }
  }, [selectedItem, allCollectionImages])

  // Navigation functions
  const handlePrevImage = () => {
    if (allCollectionImages.length === 0) return
    const prevIndex = currentImageIndex === 0 ? allCollectionImages.length - 1 : currentImageIndex - 1
    setSelectedItem(allCollectionImages[prevIndex])
  }

  const handleNextImage = () => {
    if (allCollectionImages.length === 0) return
    const nextIndex = (currentImageIndex + 1) % allCollectionImages.length
    setSelectedItem(allCollectionImages[nextIndex])
  }

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
    if (!fullscreenItem || !allCollectionImages) return
    
    const currentIndex = allCollectionImages.findIndex(item => item.id === fullscreenItem.id)
    const nextIndex = (currentIndex + 1) % allCollectionImages.length
    setFullscreenItem(allCollectionImages[nextIndex])
  }

  const handleFullscreenPrev = () => {
    if (!fullscreenItem || !allCollectionImages) return
    
    const currentIndex = allCollectionImages.findIndex(item => item.id === fullscreenItem.id)
    const prevIndex = currentIndex === 0 ? allCollectionImages.length - 1 : currentIndex - 1
    setFullscreenItem(allCollectionImages[prevIndex])
  }

  // Listen for item deletion and clear selected item
  useEffect(() => {
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event?.type === 'updated' && event.query.queryKey[0] === 'items') {
        // Check if selected item still exists in the updated data
        const updatedData = event.query.state.data as any
        if (selectedItem && updatedData?.pages) {
          const allItems = updatedData.pages.flatMap((page: any) => page.data)
          const itemExists = allItems.some((item: any) => item.id === selectedItem.id)
          if (!itemExists) {
            // Item was deleted, clear selected item
            setSelectedItem(null)
          }
        }
      }
    })

    return unsubscribe
  }, [queryClient, selectedItem])

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
  }, [isFullscreen, fullscreenItem, allCollectionImages])

  // True masonry breakpoints - responsive column count (adjusted for larger images)
  const breakpoints = {
    default: 4, // Reduced from 5 to accommodate larger images
    1600: 3,    // Reduced from 4
    1200: 3,    // Keep 3
    768: 2,     // Keep 2
    480: 1,     // Keep 1
  }

  if (isLoading) {
    return (
      <Container maxW="7xl" py={10}>
        <VStack>
          <Spinner size="xl" />
          <Text>Loading collection items...</Text>
        </VStack>
      </Container>
    )
  }

  if (isError) {
    return (
      <EmptyState.Root>
        <EmptyState.Content>
          <EmptyState.Indicator>
            <FiImage size="48" />
          </EmptyState.Indicator>
          <VStack textAlign="center">
            <EmptyState.Title>Error loading collection items</EmptyState.Title>
            <EmptyState.Description>
              Something went wrong. Please try refreshing the page.
            </EmptyState.Description>
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
            <EmptyState.Title>This collection is empty</EmptyState.Title>
            <EmptyState.Description>
              No items have been added to this collection yet. Upload some images to get started!
            </EmptyState.Description>
          </VStack>
        </EmptyState.Content>
      </EmptyState.Root>
    )
  }

  return (
    <>
      {/* Inline Image Details at the top */}
      <InlineImageDetails 
        selectedItem={selectedItem} 
        setSelectedItem={setSelectedItem}
        allCollectionImages={allCollectionImages}
        currentImageIndex={currentImageIndex}
        handlePrevImage={handlePrevImage}
        handleNextImage={handleNextImage}
        handleFullscreenOpen={handleFullscreenOpen}
      />
      
      <InfiniteScroll
        dataLength={items.length}
        next={fetchNextPage}
        hasMore={hasNextPage || false}
        loader={
          <Flex justify="center" py={8}>
            <Spinner size="lg" color="blue.500" />
          </Flex>
        }
        endMessage={
          items.length > 0 && (
            <Flex justify="center" py={8}>
              <Text color="gray.500" fontSize="sm">
                You've reached the end! {items.length} items in this collection.
              </Text>
            </Flex>
          )
        }
        scrollThreshold={0.8}
      >
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
                mb={6} // Increased from 5 to 6 for better spacing
                              transition="all 0.3s ease"
              cursor="pointer"
                              shadow="md"
                              position="relative"
                              _hover={{ 
                                transform: "scale(1.04)",
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
                                    bg={isItemInFavorites(item.collection_id) ? "gray.400" : "ui.main"}
                                    color="white"
                                    borderRadius="full"
                                    shadow="lg"
                                    loading={isSavingItem}
                                    _hover={{ bg: isItemInFavorites(item.collection_id) ? "gray.500" : "ui.main", opacity: 0.8 }}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      saveItemMutation.mutate({
                                        itemId: item.id,
                                        isSaved: isItemInFavorites(item.collection_id)
                                      })
                                    }}
                                  >
                      <FiBookmark style={{ marginRight: '4px' }} />
                                    {isItemInFavorites(item.collection_id) ? "Saved" : "Save"}
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
      </InfiniteScroll>
      
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
              {allCollectionImages && allCollectionImages.length > 1 && (
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
                  bg={isItemInFavorites(fullscreenItem.collection_id) ? "gray.400" : "ui.main"}
                  color="white"
                  borderRadius="full"
                  shadow="xl"
                  loading={isSavingItem}
                  _hover={{ bg: isItemInFavorites(fullscreenItem.collection_id) ? "gray.500" : "ui.main", opacity: 0.8 }}
                  onClick={(e) => {
                    e.stopPropagation()
                    saveItemMutation.mutate({
                      itemId: fullscreenItem.id,
                      isSaved: isItemInFavorites(fullscreenItem.collection_id)
                    })
                  }}
                >
                  <FiBookmark style={{ marginRight: '4px' }} />
                  {isItemInFavorites(fullscreenItem.collection_id) ? "Saved" : "Save"}
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