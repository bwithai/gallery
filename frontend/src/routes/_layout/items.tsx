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
            <Box minH="95vh" overflowY="auto" p={6}>
              {/* Layout with large main image and masonry grid */}
              <Box maxW="7xl" mx="auto">
                {/* Large main image positioned in upper left, taking about half screen */}
                {(() => {
                  const aspectRatio = selectedItem.width && selectedItem.height 
                    ? selectedItem.width / selectedItem.height : 1
                  
                  return (
                    <Box
                      key={`main-${selectedItem.id}`}
                      bg="white"
                      borderRadius="3xl"
                      overflow="hidden"
                      mb={8}
                      shadow="2xl"
                      border="4px solid"
                      borderColor="blue.400"
                      position="relative"
                      w={{ base: "full", md: "65%", lg: "55%" }}
                      float={{ base: "none", md: "left" }}
                      mr={{ base: 0, md: 6 }}
                      mb={{ base: 8, md: 6 }}
                    >
                      {/* Large main image */}
                      <AuthenticatedImage
                        src={`/api/v1/items/${selectedItem.id}/image`}
                        alt={selectedItem.alt_text || selectedItem.title}
                        objectFit="cover"
                        w="full"
                        h={{ base: "60vh", md: "70vh", lg: "75vh" }}
                        fallback={
                          <Box
                            bg="gray.200"
                            display="flex"
                            alignItems="center"
                            justifyContent="center"
                            w="full"
                            h={{ base: "60vh", md: "70vh", lg: "75vh" }}
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
                            noOfLines={4}
                            textShadow="0 1px 3px rgba(0,0,0,0.7)"
                            lineHeight="1.5"
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

                      {/* Action Menu */}
                      <Box
                        position="absolute"
                        top="4"
                        right="4"
                        bg="white"
                        borderRadius="full"
                        shadow="xl"
                        p={2}
                      >
                        <ItemActionsMenu item={selectedItem} inModal={true} />
                      </Box>
                    </Box>
                  )
                })()}

                {/* Related images masonry grid flowing around the main image */}
                {relatedData?.data && relatedData.data.length > 1 && (
                  <Box
                    css={{
                      columnCount: { base: 1, sm: 2, md: 2, lg: 3, xl: 4 },
                      columnGap: '1.5rem',
                      columnFill: 'balance',
                    }}
                  >
                    {relatedData.data
                      .filter(relatedItem => relatedItem.id !== selectedItem.id)
                      .map((relatedItem) => {
                        // Calculate display height based on actual aspect ratio - same as main gallery
                        const aspectRatio = relatedItem.width && relatedItem.height 
                          ? relatedItem.width / relatedItem.height : 1
                        const baseWidth = 450 // Same as main gallery items
                        const calculatedHeight = Math.round(baseWidth / aspectRatio)
                        
                        return (
                          <Box
                            key={relatedItem.id}
                            bg="white"
                            borderRadius="2xl"
                            overflow="hidden"
                            mb={6}
                            breakInside="avoid"
                            cursor="pointer"
                            transition="all 0.3s ease"
                            shadow="lg"
                            position="relative"
                            _hover={{ 
                              transform: "scale(1.05)",
                              shadow: "xl",
                              "& .pinterest-overlay": {
                                opacity: 1
                              },
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
                              fallback={
                                <Box
                                  bg="gray.200"
                                  display="flex"
                                  alignItems="center"
                                  justifyContent="center"
                                  w="full"
                                  h={`${calculatedHeight}px`}
                                >
                                  <FiImage size="48" color="gray.400" />
                                </Box>
                              }
                            />
                            
                            {/* Pinterest-style hover overlay */}
                            <Box
                              className="pinterest-overlay"
                              position="absolute"
                              top="0"
                              left="0"
                              right="0"
                              bottom="0"
                              bg="rgba(0,0,0,0.3)"
                              opacity={0}
                              transition="all 0.2s ease"
                              display="flex"
                              alignItems="flex-end"
                              p={4}
                            >
                              <VStack align="start" gap={1} color="white" w="full">
                                <Heading 
                                  size="sm" 
                                  noOfLines={2}
                                  textShadow="0 1px 2px rgba(0,0,0,0.7)"
                                >
                                  {relatedItem.title}
                                </Heading>
                                {relatedItem.description && (
                                  <Text 
                                    fontSize="xs" 
                                    noOfLines={2}
                                    textShadow="0 1px 2px rgba(0,0,0,0.7)"
                                  >
                                    {relatedItem.description}
                                  </Text>
                                )}
                              </VStack>
                            </Box>
                            
                            {/* Action Menu Overlay */}
                            <Box
                              className="related-action-menu"
                              position="absolute"
                              top="3"
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
                          </Box>
                        )
                      })}
                  </Box>
                )}

                {/* Clear float after all content */}
                <Box clear="both" />

                {/* Show message if no related images */}
                {(!relatedData?.data || relatedData.data.length <= 1) && (
                  <Box
                    bg="gray.50"
                    borderRadius="2xl"
                    p={8}
                    mb={6}
                    breakInside="avoid"
                    textAlign="center"
                    css={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}
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
