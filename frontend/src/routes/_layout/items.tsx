import {
  Box,
  Container,
  EmptyState,
  Flex,
  Heading,
  Text,
  VStack,
} from "@chakra-ui/react"
import { useState, useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { FiImage } from "react-icons/fi"
import { z } from "zod"

import { ItemsService } from "@/client"
import { ItemActionsMenu } from "@/components/Common/ItemActionsMenu"
import { AuthenticatedImage } from "@/components/Common/AuthenticatedImage"
import AddItem from "@/components/Items/AddItem"
import PendingItems from "@/components/Pending/PendingItems"
import {
  DialogCloseTrigger,
  DialogContent,
  DialogRoot,
} from "@/components/ui/dialog"
import {
  PaginationItems,
  PaginationNextTrigger,
  PaginationPrevTrigger,
  PaginationRoot,
} from "@/components/ui/pagination.tsx"

const itemsSearchSchema = z.object({
  page: z.number().catch(1),
})

const PER_PAGE = 12

function getItemsQueryOptions({ page }: { page: number }) {
  return {
    queryFn: () =>
      ItemsService.readItems({ skip: (page - 1) * PER_PAGE, limit: PER_PAGE }),
    queryKey: ["items", { page }],
  }
}

export const Route = createFileRoute("/_layout/items")({
  component: Items,
  validateSearch: (search) => itemsSearchSchema.parse(search),
})

function ImageGallery() {
  const navigate = useNavigate({ from: Route.fullPath })
  const { page } = Route.useSearch()
  const [isOpen, setIsOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<any>(null)
  const queryClient = useQueryClient()

  const { data, isLoading, isPlaceholderData } = useQuery({
    ...getItemsQueryOptions({ page }),
    placeholderData: (prevData) => prevData,
  })

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


  const setPage = (page: number) => {
    navigate({
      to: "/items",
      search: (prev) => ({ ...prev, page }),
    })
  }

  const handleImageClick = (item: any) => {
    setSelectedItem(item)
    setIsOpen(true)
  }

  // Listen for item deletion and close modal
  useEffect(() => {
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event?.type === 'updated' && event.query.queryKey[0] === 'items') {
        // Check if selected item still exists in the updated data
        const updatedData = event.query.state.data as any
        if (selectedItem && updatedData?.data) {
          const itemExists = updatedData.data.some((item: any) => item.id === selectedItem.id)
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

  const items = data?.data.slice(0, PER_PAGE) ?? []
  const count = data?.count ?? 0

  if (isLoading) {
    return <PendingItems />
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
      {/* Pinterest-style masonry grid - images only */}
      <Box
        css={{
          columnCount: { base: 1, sm: 2, md: 2, lg: 3, xl: 4 },
          columnGap: '1.25rem',
          columnFill: 'balance',
        }}
      >
        {items?.map((item) => {
          // Calculate display height based on actual aspect ratio with much larger base width
          const aspectRatio = item.width && item.height ? item.width / item.height : 1
          const baseWidth = 450 // Further increased base width for much larger images
          const calculatedHeight = Math.round(baseWidth / aspectRatio)
          
          return (
            <Box
              key={item.id}
              opacity={isPlaceholderData ? 0.5 : 1}
              borderRadius="2xl"
              overflow="hidden"
              mb={5}
              breakInside="avoid"
              transition="all 0.3s ease"
              cursor="pointer"
              shadow="md"
              position="relative"
              _hover={{ 
                transform: "scale(1.04)",
                shadow: "lg",
                filter: "brightness(0.98)",
                "& .action-menu": {
                  opacity: 1,
                  visibility: "visible"
                }
              }}
              css={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}
              onClick={() => handleImageClick(item)}
            >
              <AuthenticatedImage
                src={`/api/v1/items/${item.id}/image`}
                alt={item.alt_text || item.title}
                objectFit="cover"
                w="full"
                h={`${calculatedHeight}px`}
                borderRadius="2xl"
                fallback={
                  <Box
                    bg="gray.200"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    w="full"
                    h={`${calculatedHeight}px`}
                    borderRadius="2xl"
                  >
                    <FiImage size="64" color="gray.400" />
                  </Box>
                }
              />
              
              {/* Action Menu Overlay - appears on hover */}
              <Box
                className="action-menu"
                position="absolute"
                bottom="3"
                right="3"
                opacity={0}
                visibility="hidden"
                transition="all 0.2s ease"
                bg="white"
                borderRadius="full"
                shadow="lg"
                p={1}
                zIndex="dropdown"
                onClick={(e) => {
                  e.stopPropagation() // Prevent image click when clicking menu
                }}
              >
                <ItemActionsMenu item={item} inModal={false} />
              </Box>
            </Box>
          )
        })}
      </Box>

      {/* Pinterest-style Modal for image details */}
      <DialogRoot 
        open={isOpen} 
        onOpenChange={({ open }) => setIsOpen(open)}
        size="full"
        placement="center"
      >
        <DialogContent maxW="95vw" maxH="95vh" bg="white" borderRadius="3xl" overflow="hidden">
          <DialogCloseTrigger 
            position="absolute"
            top="4"
            right="4"
            bg="white" 
            borderRadius="full" 
            _hover={{ bg: "gray.100" }}
            zIndex="overlay"
          />
          
          {selectedItem && (
            <Flex direction={{ base: "column", lg: "row" }} h="95vh" maxH="95vh">
              {/* Left half - Image and its details */}
              <Box w={{ base: "full", lg: "50%" }} p={6} overflowY="auto" maxH="100%">
                <VStack align="start" gap={6}>
                  {/* Main image */}
                  <Box w="full" display="flex" alignItems="center" justifyContent="center" bg="gray.50" borderRadius="xl" p={4}>
                    <AuthenticatedImage
                      src={`/api/v1/items/${selectedItem.id}/image`}
                      alt={selectedItem.alt_text || selectedItem.title}
                      objectFit="contain"
                      maxW="full"
                      maxH="60vh"
                      borderRadius="lg"
                    />
                  </Box>
                  
                  {/* Image details below the image */}
                  <Box w="full">
                    <Heading size="xl" mb={3} color="gray.800">
                      {selectedItem.title}
                    </Heading>
                    {selectedItem.description && (
                      <Text color="gray.600" mb={4} fontSize="md" lineHeight="1.6">
                        {selectedItem.description}
                      </Text>
                    )}
                    
                    <Flex gap={6} fontSize="sm" color="gray.500" wrap="wrap">
                      <Text fontWeight="medium">{selectedItem.width} × {selectedItem.height}</Text>
                      <Text fontWeight="medium">{selectedItem.mime_type}</Text>
                      <Text fontWeight="medium">{new Date(selectedItem.upload_date).toLocaleDateString()}</Text>
                    </Flex>
                  </Box>
                </VStack>
              </Box>
              
              {/* Right half - All Related images (scrollable) */}
              <Box w={{ base: "full", lg: "50%" }} bg="gray.50" display="flex" flexDirection="column" h="100%" maxH="100%">
                {relatedData?.data && relatedData.data.length > 1 ? (
                  <>
                    {/* Header - fixed */}
                    <Box p={6} pb={4} borderBottom="1px" borderColor="gray.200">
                      <Heading size="lg" color="gray.800" mb={2}>
                        More from this collection
                      </Heading>
                      <Text fontSize="sm" color="gray.600">
                        {relatedData.data.length - 1} other images in this collection
                      </Text>
                    </Box>
                    
                    {/* Scrollable content area */}
                    <Box flex="1" overflowY="auto" overflowX="hidden" p={6} pt={4} maxH="calc(100vh - 120px)">
                      {/* Pinterest-style masonry grid for related images */}
                      <Box
                        css={{
                          columnCount: { base: 1, md: 2 },
                          columnGap: '1rem',
                          columnFill: 'balance',
                        }}
                      >
                        {relatedData.data
                          .filter(relatedItem => relatedItem.id !== selectedItem.id)
                          .map((relatedItem) => {
                            // Calculate display height based on actual aspect ratio
                            const aspectRatio = relatedItem.width && relatedItem.height 
                              ? relatedItem.width / relatedItem.height : 1
                            const baseWidth = 280 // Smaller base width for modal
                            const calculatedHeight = Math.round(baseWidth / aspectRatio)
                            
                            return (
                              <Box
                                key={relatedItem.id}
                                borderRadius="2xl"
                                overflow="hidden"
                                mb={4}
                                breakInside="avoid"
                                cursor="pointer"
                                transition="all 0.3s ease"
                                shadow="md"
                                position="relative"
                                _hover={{ 
                                  transform: "scale(1.04)",
                                  shadow: "lg",
                                  filter: "brightness(0.98)",
                                  "& .related-action-menu": {
                                    opacity: 1,
                                    visibility: "visible"
                                  }
                                }}
                                css={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}
                                onClick={() => setSelectedItem(relatedItem)}
                              >
                                <AuthenticatedImage
                                  src={`/api/v1/items/${relatedItem.id}/image`}
                                  alt={relatedItem.alt_text || relatedItem.title}
                                  objectFit="cover"
                                  w="full"
                                  h={`${calculatedHeight}px`}
                                  borderRadius="2xl"
                                  fallback={
                                    <Box
                                      bg="gray.200"
                                      display="flex"
                                      alignItems="center"
                                      justifyContent="center"
                                      w="full"
                                      h={`${calculatedHeight}px`}
                                      borderRadius="2xl"
                                    >
                                      <FiImage size="32" color="gray.400" />
                                    </Box>
                                  }
                                />
                                
                                {/* Action Menu Overlay for Related Images */}
                                <Box
                                  className="related-action-menu"
                                  position="absolute"
                                  bottom="3"
                                  right="3"
                                  opacity={0}
                                  visibility="hidden"
                                  transition="all 0.2s ease"
                                  bg="white"
                                  borderRadius="full"
                                  shadow="lg"
                                  p={1}
                                  zIndex="dropdown"
                                  onClick={(e) => {
                                    e.stopPropagation() // Prevent switching to this image when clicking menu
                                  }}
                                  onMouseDown={(e) => {
                                    e.stopPropagation() // Stop propagation on mouse down too
                                  }}
                                  onPointerDown={(e) => {
                                    e.stopPropagation() // Stop propagation on pointer down
                                  }}
                                >
                                  <ItemActionsMenu item={relatedItem} inModal={true} />
                                </Box>
                              </Box>
                            )
                          })}
                      </Box>
                      
                      {/* Bottom spacing for better scroll experience */}
                      <Box h={4} />
                    </Box>
                  </>
                ) : (
                  <Box display="flex" alignItems="center" justifyContent="center" h="full" p={6}>
                    <VStack>
                      <Text color="gray.500" fontSize="lg" textAlign="center">
                        No other images in this collection
                      </Text>
                      <Text color="gray.400" fontSize="sm" textAlign="center">
                        This is the only image in this collection
                      </Text>
                    </VStack>
                  </Box>
                )}
              </Box>
            </Flex>
          )}
        </DialogContent>
      </DialogRoot>
      
      {count > PER_PAGE && (
        <Flex justifyContent="center" mt={8}>
          <PaginationRoot
            count={count}
            pageSize={PER_PAGE}
            onPageChange={({ page }) => setPage(page)}
          >
            <Flex>
              <PaginationPrevTrigger />
              <PaginationItems />
              <PaginationNextTrigger />
            </Flex>
          </PaginationRoot>
        </Flex>
      )}
    </>
  )
}

function Items() {
  return (
    <Container maxW="full">
      <Heading size="lg" pt={12}>
        Image Gallery
      </Heading>
      <AddItem />
      <ImageGallery />
    </Container>
  )
}
