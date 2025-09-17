import { Box, Flex, Icon, Text, Spinner, Button } from "@chakra-ui/react"
import { Link as RouterLink, useRouterState } from "@tanstack/react-router"
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query"
import { FiHome, FiFolder, FiUsers, FiPlus } from "react-icons/fi"
import type { IconType } from "react-icons/lib"
import { useState } from "react"
import { useForm, type SubmitHandler } from "react-hook-form"

import { CollectionsService, UserPublic, type CollectionCreate } from "@/client"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"
import {
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTrigger,
  DialogTitle,
  DialogActionTrigger,
} from "../ui/dialog"
import { Field } from "../ui/field"
import { Input, Textarea } from "@chakra-ui/react"

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

interface CreateCollectionModalProps {
  onClose?: () => void
}

const CreateCollectionModal = ({ onClose }: CreateCollectionModalProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const queryClient = useQueryClient()
  const { showSuccessToast } = useCustomToast()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CollectionCreate>({
    mode: "onSubmit",
    criteriaMode: "firstError",
    defaultValues: {
      name: "",
      description: "",
      is_public: false,
    },
  })

  const mutation = useMutation({
    mutationFn: (data: CollectionCreate) =>
      CollectionsService.createCollection({ requestBody: data }),
    onSuccess: () => {
      showSuccessToast("Collection created successfully.")
      reset()
      setIsOpen(false)
      queryClient.invalidateQueries({ queryKey: ["collections"] })
      onClose?.()
    },
    onError: (err: any) => {
      handleError(err)
    },
  })

  const onSubmit: SubmitHandler<CollectionCreate> = (data) => {
    mutation.mutate(data)
  }

  return (
    <DialogRoot open={isOpen} onOpenChange={(e) => setIsOpen(e.open)}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          colorScheme="teal"
          width="full"
          mt={2}
        >
          <FiPlus style={{ marginRight: '8px' }} />
          Create Collection
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Collection</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <form id="collection-form" onSubmit={handleSubmit(onSubmit)}>
            <Flex direction="column" gap={4}>
              <Field
                required
                invalid={!!errors.name}
                errorText={errors.name?.message}
                label="Name"
              >
                <Input
                  id="name"
                  {...register("name", {
                    required: "Name is required.",
                    minLength: { value: 1, message: "Name must be at least 1 character" },
                    maxLength: { value: 255, message: "Name must be less than 255 characters" },
                  })}
                  placeholder="Enter collection name"
                  type="text"
                />
              </Field>

              <Field
                invalid={!!errors.description}
                errorText={errors.description?.message}
                label="Description (Optional)"
              >
                <Textarea
                  id="description"
                  {...register("description", {
                    maxLength: { value: 1000, message: "Description must be less than 1000 characters" },
                  })}
                  placeholder="Enter collection description"
                  rows={3}
                />
              </Field>

              <Field label="Visibility">
                <Flex align="center" gap={2}>
                  <input
                    type="checkbox"
                    id="is_public"
                    {...register("is_public")}
                  />
                  <label htmlFor="is_public" style={{ fontSize: '14px' }}>
                    Make this collection public
                  </label>
                </Flex>
              </Field>
            </Flex>
          </form>
        </DialogBody>
        <DialogFooter>
          <DialogActionTrigger asChild>
            <Button variant="outline">Cancel</Button>
          </DialogActionTrigger>
          <Button
            variant="solid"
            colorScheme="teal"
            type="submit"
            form="collection-form"
            loading={isSubmitting}
          >
            Create Collection
          </Button>
        </DialogFooter>
        <DialogCloseTrigger />
      </DialogContent>
    </DialogRoot>
  )
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
      
      {/* Scrollable Collections Container */}
      <Box 
        flex="1" 
        overflowY="auto" 
        maxH="calc(100vh - 300px)"
        mb={2}
        css={{
          '&::-webkit-scrollbar': {
            width: '4px',
          },
          '&::-webkit-scrollbar-track': {
            background: 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            background: '#cbd5e0',
            borderRadius: '2px',
          },
          '&::-webkit-scrollbar-thumb:hover': {
            background: '#a0aec0',
          },
        }}
      >
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
      
      {/* Create Collection Button */}
      <Box px={4} mb={4}>
        <CreateCollectionModal onClose={onClose} />
      </Box>
    </>
  )
}

export default SidebarItems
