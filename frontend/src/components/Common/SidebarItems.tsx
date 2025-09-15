import { Box, Flex, Icon, Text, Spinner } from "@chakra-ui/react"
import { Link as RouterLink, useRouterState } from "@tanstack/react-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { FiHome, FiFolder, FiUsers } from "react-icons/fi"
import type { IconType } from "react-icons/lib"

import { CollectionsService, UserPublic } from "@/client"

const items = [
  { icon: FiHome, title: "Dashboard", path: "/" },
]

interface SidebarItemsProps {
  onClose?: () => void
}

interface Item {
  icon: IconType
  title: string
  path: string
}

const SidebarItems = ({ onClose }: SidebarItemsProps) => {
  const { location } = useRouterState()
  const queryClient = useQueryClient()
  const currentUser = queryClient.getQueryData<UserPublic>(["currentUser"])

  const finalItems: Item[] = currentUser?.is_superuser
    ? [...items, { icon: FiUsers, title: "Admin", path: "/admin" }]
    : items

  // Fetch collections from API
  const { data: collectionsData, isLoading, error } = useQuery({
    queryKey: ["collections"],
    queryFn: () => CollectionsService.readCollections({}),
  })

  // Create collection items
  const collectionItems: Item[] =
    collectionsData?.data?.map((collection) => ({
      icon: FiFolder,
      title: collection.name,
      path: `/collections/${collection.id}`,
    })) || []

  // Generic renderer
  const renderItems = (items: Item[], sectionTitle: string) => {
    const isSectionActive = items.some((i) => location.pathname.startsWith(i.path))

    return (
      <>
        <Text
          fontSize="xs"
          px={4}
          py={2}
          fontWeight="bold"
          color={isSectionActive ? "teal.600" : "gray.600"}
        >
          {sectionTitle}
        </Text>
        <Box mb={4}>
          {items.map(({ icon, title, path }) => {
            const isActive = location.pathname === path
            return (
              <RouterLink key={title} to={path} onClick={onClose}>
                <Flex
                  gap={4}
                  px={4}
                  py={2}
                  borderRadius="md"
                  alignItems="center"
                  fontSize="sm"
                  bg={isActive ? "teal.600" : "transparent"}
                  color={isActive ? "white" : "gray.800"}
                  fontWeight={isActive ? "bold" : "normal"}
                  _hover={{
                    background: isActive ? "teal.700" : "gray.100",
                    color: isActive ? "white" : "gray.900",
                  }}
                  transition="all 0.2s ease"
                >
                  <Icon as={icon} alignSelf="center" />
                  <Text ml={2}>{title}</Text>
                </Flex>
              </RouterLink>
            )
          })}
        </Box>
      </>
    )
  }

  return (
    <>
      {/* Static Menu Items */}
      {renderItems(finalItems, "Menu")}

      {/* Collections Section */}
      <Text
        fontSize="xs"
        px={4}
        py={2}
        fontWeight="bold"
        color={
          collectionItems.some((i) => location.pathname.startsWith(i.path))
            ? "teal.600"
            : "gray.600"
        }
      >
        Collections
      </Text>
      <Box mb={4}>
        {isLoading && (
          <Flex px={4} py={2} alignItems="center" fontSize="sm">
            <Spinner size="sm" mr={2} />
            <Text ml={2}>Loading collections...</Text>
          </Flex>
        )}

        {error && (
          <Flex px={4} py={2} alignItems="center" fontSize="sm">
            <Text ml={2} color="red.500">
              Failed to load collections
            </Text>
          </Flex>
        )}

        {!isLoading && !error && collectionItems.length === 0 && (
          <Flex px={4} py={2} alignItems="center" fontSize="sm">
            <Text ml={2} color="gray.500">
              No collections found
            </Text>
          </Flex>
        )}

        {collectionItems.map(({ icon, title, path }) => {
          const isActive = location.pathname === path
          return (
            <RouterLink key={title} to={path} onClick={onClose}>
              <Flex
                gap={4}
                px={4}
                py={2}
                borderRadius="md"
                alignItems="center"
                fontSize="sm"
                bg={isActive ? "teal.600" : "transparent"}
                color={isActive ? "white" : "gray.800"}
                fontWeight={isActive ? "bold" : "normal"}
                _hover={{
                  background: isActive ? "teal.700" : "gray.100",
                  color: isActive ? "white" : "gray.900",
                }}
                transition="all 0.2s ease"
              >
                <Icon as={icon} alignSelf="center" />
                <Text ml={2}>{title}</Text>
              </Flex>
            </RouterLink>
          )
        })}
      </Box>
    </>
  )
}

export default SidebarItems
