import {
  Button,
  ButtonGroup,
  DialogActionTrigger,
  Input,
  Text,
  VStack,
  Box,
  Image,
  AspectRatio,
  Textarea,
  Grid,
  GridItem,
} from "@chakra-ui/react"
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { type SubmitHandler, useForm } from "react-hook-form"
import { FaExchangeAlt } from "react-icons/fa"

import { type ItemPublic, CollectionsService } from "@/client"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"
import {
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog"
import { Field } from "../ui/field"

interface EditItemProps {
  item: ItemPublic
}

interface ItemUpdateForm {
  title: string
  description?: string
  alt_text?: string
  veneration?: string
  commission_date?: string
  owned_since?: string
  monitory_value?: number
  collection_id?: number
  file?: FileList
}

const EditItem = ({ item }: EditItemProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [currentImage, setCurrentImage] = useState<string>(`/api/v1/items/${item.id}/image`)
  const queryClient = useQueryClient()
  const { showSuccessToast } = useCustomToast()
  
  // Format dates for form inputs
  const formatDateForInput = (dateString: string | null) => {
    if (!dateString) return ""
    try {
      return new Date(dateString).toISOString().split('T')[0]
    } catch {
      return ""
    }
  }
  
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ItemUpdateForm>({
    mode: "onSubmit",
    criteriaMode: "firstError",
    defaultValues: {
      title: item.title,
      description: item.description ?? "",
      alt_text: item.alt_text ?? "",
      veneration: item.veneration ?? "",
      commission_date: formatDateForInput(item.commission_date || null),
      owned_since: formatDateForInput(item.owned_since || null),
      monitory_value: item.monitory_value ?? undefined,
      collection_id: item.collection_id,
    },
  })

  
  // Fetch available collections
  const { data: collectionsData } = useQuery({
    queryKey: ["collections"],
    queryFn: () => CollectionsService.readCollections({}),
  })

  const mutation = useMutation({
    mutationFn: async (data: ItemUpdateForm) => {
      const formData = new FormData()
      
      // Add form fields
      if (data.title !== item.title) formData.append("title", data.title)
      if (data.description !== item.description) formData.append("description", data.description || "")
      if (data.alt_text !== item.alt_text) formData.append("alt_text", data.alt_text || "")
      if (data.veneration !== item.veneration) formData.append("veneration", data.veneration || "")
      
      // Only send date fields if they have values, convert to ISO format
      if (data.commission_date && data.commission_date.trim() !== "") {
        formData.append("commission_date", new Date(data.commission_date).toISOString())
      }
      if (data.owned_since && data.owned_since.trim() !== "") {
        formData.append("owned_since", new Date(data.owned_since).toISOString())
      }
      
      if (data.monitory_value !== undefined && data.monitory_value !== 0) formData.append("monitory_value", data.monitory_value.toString())
      
        if (data.collection_id !== undefined && data.collection_id !== item.collection_id) {
        formData.append("collection_id", data.collection_id.toString())
      }
      
      // Add file if selected
      if (data.file && data.file.length > 0) {
        formData.append("file", data.file[0])
      }
      
      // Get auth token from localStorage
      const token = localStorage.getItem("access_token")
      
      const response = await fetch(`/api/v1/items/${item.id}`, {
        method: "PUT",
        body: formData,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          // Don't set Content-Type, let browser set it with boundary
        },
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Update failed: ${errorText}`)
      }
      
      return response.json()
    },
    onSuccess: (data) => {
      showSuccessToast("Item updated successfully.")
      reset()
      setPreview(null)
      setIsOpen(false)
      
      // Invalidate all items queries
      queryClient.invalidateQueries({ queryKey: ["items"] })
      
      // Also invalidate collection-specific queries for both old and new collections
      const updatedCollectionId = data.collection_id || item.collection_id
      if (updatedCollectionId) {
        queryClient.invalidateQueries({ 
          queryKey: ["items", "collection", updatedCollectionId] 
        })
        queryClient.invalidateQueries({ 
          queryKey: ["related-items", updatedCollectionId] 
        })
      }
      
      // If collection changed, also invalidate the old collection
      if (item.collection_id !== updatedCollectionId) {
        queryClient.invalidateQueries({ 
          queryKey: ["items", "collection", item.collection_id] 
        })
        queryClient.invalidateQueries({ 
          queryKey: ["related-items", item.collection_id] 
        })
      }
    },
    onError: (err: any) => {
      handleError(err)
    },
  })

  const onSubmit: SubmitHandler<ItemUpdateForm> = async (data) => {
    mutation.mutate(data)
  }

  // Handle file selection and preview
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    } else {
      setPreview(null)
    }
  }

  const collections = collectionsData?.data || []

  return (
    <DialogRoot
      size={{ base: "sm", md: "xl" }}
      placement="center"
      open={isOpen}
      onOpenChange={({ open }) => setIsOpen(open)}
    >
      <DialogTrigger asChild>
        <Button variant="ghost">
          <FaExchangeAlt fontSize="16px" />
          Edit Item
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Edit Item</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <VStack gap={6}>
              {/* Current Image Preview */}
              <Box w="full" border="1px solid" borderColor="gray.200" borderRadius="md" bg="white">
                <Box p={4}>
                  <Text fontSize="sm" mb={3} fontWeight="medium" color="gray.600">
                    {preview ? "New Image Preview:" : "Current Image:"}
                  </Text>
                  <Box display="flex" justifyContent="center">
                    <AspectRatio ratio={16 / 9} maxW="500px" w="full">
                      <Image
                        src={preview || currentImage}
                        alt={item.title}
                        objectFit="contain"
                        borderRadius="md"
                        border="1px solid"
                        borderColor="gray.200"
                        bg="gray.50"
                        onError={() => setCurrentImage("/placeholder-image.png")}
                      />
                    </AspectRatio>
                  </Box>
                </Box>
              </Box>

              {/* File Upload for Image Replacement */}
              <Box w="full">
                <Field
                  invalid={!!errors.file}
                  errorText={errors.file?.message}
                  label="Replace Image (Optional)"
                >
                  <Input
                    type="file"
                    accept="image/*"
                    {...register("file", {
                      onChange: handleFileChange,
                    })}
                  />
                </Field>
                <Text fontSize="xs" color="gray.500" mt={1}>
                  Leave empty to keep the current image
                </Text>
              </Box>

              {/* Form Fields in Two Column Grid */}
              <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={4} w="full">
                {/* Left Column */}
                <GridItem>
                  <VStack gap={4}>
                    {/* Collection Selection */}
                    <Field
                      required
                      invalid={!!errors.collection_id}
                      errorText={errors.collection_id?.message}
                      label="Collection"
                    >
                      <select
                        {...register("collection_id", {
                          required: "Please select a collection.",
                          valueAsNumber: true,
                        })}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          border: '1px solid #e2e8f0',
                          borderRadius: '6px',
                          fontSize: '14px',
                          backgroundColor: 'white',
                          color: '#2d3748'
                        }}
                      >
                        <option value="">Select a collection...</option>
                        {collections.map((collection) => (
                          <option key={collection.id} value={collection.id}>
                            {collection.name}
                          </option>
                        ))}
                      </select>
                    </Field>

                    {/* Title */}
                    <Field
                      required
                      invalid={!!errors.title}
                      errorText={errors.title?.message}
                      label="Title"
                    >
                      <Input
                        id="title"
                        {...register("title", {
                          required: "Title is required.",
                        })}
                        placeholder="Enter image title"
                        type="text"
                      />
                    </Field>

                    {/* Veneration */}
                    <Field
                      invalid={!!errors.veneration}
                      errorText={errors.veneration?.message}
                      label="Veneration"
                    >
                      <Input
                        id="veneration"
                        {...register("veneration")}
                        placeholder="Artist, maker, or origin (optional)"
                        type="text"
                      />
                    </Field>

                    {/* Commission Date */}
                    <Field
                      invalid={!!errors.commission_date}
                      errorText={errors.commission_date?.message}
                      label="Commission Date"
                    >
                      <Input
                        id="commission_date"
                        {...register("commission_date")}
                        placeholder="When was it created?"
                        type="date"
                      />
                    </Field>
                  </VStack>
                </GridItem>

                {/* Right Column */}
                <GridItem>
                  <VStack gap={4}>
                    {/* Owned Since */}
                    <Field
                      invalid={!!errors.owned_since}
                      errorText={errors.owned_since?.message}
                      label="Owned Since"
                    >
                      <Input
                        id="owned_since"
                        {...register("owned_since")}
                        placeholder="When did you acquire it?"
                        type="date"
                      />
                    </Field>

                    {/* Monitory Value */}
                    <Field
                      invalid={!!errors.monitory_value}
                      errorText={errors.monitory_value?.message}
                      label="Monitory Value"
                    >
                      <Input
                        id="monitory_value"
                        {...register("monitory_value", {
                          setValueAs: (value) => value === "" ? undefined : parseFloat(value),
                        })}
                        placeholder="Estimated value (optional)"
                        type="number"
                        step="0.01"
                      />
                    </Field>

                    {/* Alt Text */}
                    <Field
                      invalid={!!errors.alt_text}
                      errorText={errors.alt_text?.message}
                      label="Alt Text"
                    >
                      <Input
                        id="alt_text"
                        {...register("alt_text")}
                        placeholder="Accessibility description (optional)"
                        type="text"
                      />
                    </Field>
                  </VStack>
                </GridItem>
              </Grid>

              {/* Description - Full Width */}
              <Field
                invalid={!!errors.description}
                errorText={errors.description?.message}
                label="Description"
              >
                <Textarea
                  id="description"
                  {...register("description")}
                  placeholder="Describe your image in detail (optional)"
                  rows={4}
                />
              </Field>
            </VStack>
          </DialogBody>

          <DialogFooter gap={2}>
            <ButtonGroup>
              <DialogActionTrigger asChild>
                <Button
                  variant="subtle"
                  colorPalette="gray"
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
              </DialogActionTrigger>
              <Button variant="solid" type="submit" loading={isSubmitting}>
                Save
              </Button>
            </ButtonGroup>
          </DialogFooter>
        </form>
        <DialogCloseTrigger />
      </DialogContent>
    </DialogRoot>
  )
}

export default EditItem
