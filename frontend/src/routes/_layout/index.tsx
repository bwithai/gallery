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

import { ItemsService } from "@/client"
import { ItemActionsMenu } from "@/components/Common/ItemActionsMenu"
import { BlurUpImage } from "@/components/Common/BlurUpImage"
import AddItem from "@/components/Items/AddItem"
import PendingItems from "@/components/Pending/PendingItems"
import {
  DialogCloseTrigger,
  DialogContent,
  DialogRoot,
} from "@/components/ui/dialog"
import styles from "../Item.module.css"
import Masonry from "react-masonry-css"
import InfiniteScroll from "react-infinite-scroll-component"

const itemsSearchSchema = z.object({
  // Remove page since we're using infinite scroll
})

const PER_PAGE = 20 // Increased for better infinite scroll experience

function getItemsInfiniteQueryOptions() {
  return {
    queryFn: ({ pageParam = 0 }) =>
      ItemsService.readItems({ skip: pageParam * PER_PAGE, limit: PER_PAGE }),
    queryKey: ["items"],
    initialPageParam: 0,
    getNextPageParam: (lastPage: any, allPages: any[]) => {
      const totalItems = allPages.reduce((sum, page) => sum + page.data.length, 0)
      return totalItems < lastPage.count ? allPages.length : undefined
    },
  }
}

export const Route = createFileRoute("/_layout/")({
  component: Items,
  validateSearch: (search) => itemsSearchSchema.parse(search),
})

function ImageGallery() {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<any>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [fullscreenItem, setFullscreenItem] = useState<any>(null)
  const queryClient = useQueryClient()

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isLoading,
    isError,
  } = useInfiniteQuery(getItemsInfiniteQueryOptions())

  // Flatten all pages into a single array
  const items = useMemo(() => {
    return data?.pages.flatMap(page => page.data) ?? []
  }, [data])

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
    // return {
    //   rightSideImages: filteredRelated.slice(0, rightSideCount),
    //   bottomImages: filteredRelated.slice(rightSideCount) // Rest go to bottom
    // }
    const shuffled = [...filteredRelated].sort(() => Math.random() - 0.5)
    return {
      rightSideImages: shuffled.slice(0, rightSideCount),
      bottomImages: shuffled.slice(rightSideCount) // Rest go to bottom
    }
  }, [relatedData, selectedItem])

  const handleImageClick = (item: any) => {
    setSelectedItem(item)
    setIsOpen(true)
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

  // Listen for item deletion and close modal
  useEffect(() => {
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event?.type === 'updated' && event.query.queryKey[0] === 'items') {
        // Check if selected item still exists in the updated data
        const updatedData = event.query.state.data as any
        if (selectedItem && updatedData?.pages) {
          const allItems = updatedData.pages.flatMap((page: any) => page.data)
          const itemExists = allItems.some((item: any) => item.id === selectedItem.id)
          if (!itemExists) {
            // Item was deleted, close modal
            setIsOpen(false)
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
  }, [isFullscreen, fullscreenItem, relatedData])

  // True masonry breakpoints - responsive column count (adjusted for larger images)
  const breakpoints = {
    default: 4, // Reduced from 5 to accommodate larger images
    1600: 3,    // Reduced from 4
    1200: 3,    // Keep 3
    768: 2,     // Keep 2
    480: 1,     // Keep 1
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
                You've reached the end! {items.length} images loaded.
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
      </InfiniteScroll>

      {/* Pinterest-style Modal for image details */}
      <DialogRoot 
        open={isOpen} 
        onOpenChange={({ open }) => setIsOpen(open)}
        size="full"
        placement="center"
      >
        <DialogContent maxW="95vw" maxH="95vh" bg="white" borderRadius="3xl" overflow="auto">
          <DialogCloseTrigger 
            position="fixed"
            top="6"
            right="6"
            bg="white" 
            borderRadius="full" 
            _hover={{ bg: "gray.100" }}
            zIndex="overlay"
            shadow="lg"
          />
          
          {selectedItem && (
            <Box minH="95vh" overflowY="auto" p={{ base: 4, md: 6 }}>
              {/* Pinterest-style layout with main image on left, related on right */}
              <Box maxW="8xl" mx="auto">
                
                {/* Top section: Main image (left) + Right-side related images */}
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
                    bg="gray.50"
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
              </Box>
              
              {/* Bottom spacing for scroll */}
              <Box h={8} />
            </Box>
          )}
        </DialogContent>
      </DialogRoot>
      
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
      
      {/* Pagination removed - using infinite scroll */}
    </>
  )
}

function Items() {
  return (
    <Container maxW="full" px={{ base: 4, md: 6, lg: 8 }}> {/* Increased padding for better spacing */}
      <Heading size="lg" pt={12}>
        Image Gallery
      </Heading>
      <AddItem />
      <ImageGallery />
    </Container>
  )
}
