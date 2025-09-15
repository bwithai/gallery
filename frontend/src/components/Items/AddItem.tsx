import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { type SubmitHandler, useForm } from "react-hook-form"

import {
  Button,
  DialogActionTrigger,
  DialogTitle,
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
import { useState } from "react"
import { FaUpload } from "react-icons/fa"

import { CollectionsService } from "@/client"
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
} from "../ui/dialog"
import { Field } from "../ui/field"

interface UploadFormData {
  title: string
  description?: string
  alt_text?: string
  veneration?: string
  commission_date?: string
  owned_since?: string
  monitory_value?: number
  collection_id: string
  file: FileList
}

interface AddItemProps {
  collectionId?: number
}

const AddItem = ({ collectionId }: AddItemProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const { showSuccessToast } = useCustomToast()
  
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<UploadFormData>({
    mode: "onSubmit",
    criteriaMode: "firstError",
    defaultValues: {
      title: "",
      description: "",
      alt_text: "",
      veneration: "",
      commission_date: "",
      owned_since: "",
      monitory_value: undefined,
      collection_id: collectionId ? collectionId.toString() : "",
    },
  })

  // Watch for file changes to show preview
  const watchedFile = watch("file")
  
  // Fetch available collections
  const { data: collectionsData } = useQuery({
    queryKey: ["collections"],
    queryFn: () => CollectionsService.readCollections({}),
  })

  const mutation = useMutation({
    mutationFn: async (data: UploadFormData) => {
      const formData = new FormData()
      formData.append("file", data.file[0])
      formData.append("title", data.title)
      
      // Use the provided collectionId prop if available, otherwise use form data
      const targetCollectionId = collectionId ? collectionId.toString() : data.collection_id
      formData.append("collection_id", targetCollectionId)
      if (data.description) formData.append("description", data.description)
      if (data.alt_text) formData.append("alt_text", data.alt_text)
      if (data.veneration) formData.append("veneration", data.veneration)
      
      // Only send date fields if they have values, convert to ISO format
      if (data.commission_date && data.commission_date.trim() !== "") {
        formData.append("commission_date", new Date(data.commission_date).toISOString())
      }
      if (data.owned_since && data.owned_since.trim() !== "") {
        formData.append("owned_since", new Date(data.owned_since).toISOString())
      }
      
      if (data.monitory_value !== undefined && data.monitory_value !== 0) formData.append("monitory_value", data.monitory_value.toString())
      
      // Get auth token from localStorage
      const token = localStorage.getItem("access_token")
      const response = await fetch("/api/v1/items/upload", {
        method: "POST",
        body: formData,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          // Don't set Content-Type, let browser set it with boundary
        },
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Upload failed: ${errorText}`)
      }
      
      return response.json()
    },
    onSuccess: (data) => {
      showSuccessToast("Image uploaded successfully!")
      reset()
      setPreview(null)
      setIsOpen(false)
      
      // Invalidate all items queries
      queryClient.invalidateQueries({ queryKey: ["items"] })
      
      // Also invalidate collection-specific queries if we know the collection
      const uploadedCollectionId = data.collection_id || collectionId
      if (uploadedCollectionId) {
        const collectionIdToInvalidate = typeof uploadedCollectionId === 'string' ? 
          parseInt(uploadedCollectionId, 10) : uploadedCollectionId
        queryClient.invalidateQueries({ 
          queryKey: ["items", "collection", collectionIdToInvalidate] 
        })
        // Also invalidate related items queries that might be used in modals
        queryClient.invalidateQueries({ 
          queryKey: ["related-items", collectionIdToInvalidate] 
        })
      }
    },
    onError: (err: any) => {
      handleError(err)
    },
  })

  const onSubmit: SubmitHandler<UploadFormData> = (data) => {
    if (!data.file || data.file.length === 0) {
      return
    }
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
  
  // Find the current collection name if collectionId is provided
  const currentCollection = collectionId ? 
    collections.find(c => c.id === collectionId) : null

  return (
    <DialogRoot
      size={{ base: "sm", md: "xl" }}
      placement="center"
      open={isOpen}
      onOpenChange={({ open }) => setIsOpen(open)}
    >
      <DialogTrigger asChild>
        <Button value="add-item" my={4}>
          <FaUpload fontSize="16px" />
          Upload Image
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Upload Image</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <VStack gap={6}>
              {/* File Upload */}
              <Box w="full">
                <Field
                  required
                  invalid={!!errors.file}
                  errorText={errors.file?.message}
                  label="Image File"
                >
                  <Input
                    type="file"
                    accept="image/*"
                    {...register("file", {
                      required: "Please select an image file.",
                      onChange: handleFileChange,
                    })}
                  />
                </Field>
              </Box>

              {/* Large Image Preview */}
              {preview && (
                <Box w="full" border="1px solid" borderColor="gray.200" borderRadius="md" bg="white">
                  <Box p={4}>
                    <Text fontSize="sm" mb={3} fontWeight="medium" color="gray.600">
                      Image Preview:
                    </Text>
                    <Box display="flex" justifyContent="center">
                      <AspectRatio ratio={16 / 9} maxW="500px" w="full">
                        <Image
                          src={preview}
                          alt="Preview"
                          objectFit="contain"
                          borderRadius="md"
                          border="1px solid"
                          borderColor="gray.200"
                          bg="gray.50"
                        />
                      </AspectRatio>
                    </Box>
                  </Box>
                </Box>
              )}

              {/* Form Fields in Two Column Grid */}
              <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={4} w="full">
                {/* Left Column */}
                <GridItem>
                  <VStack gap={4}>
                    {/* Show current collection if collectionId is provided */}
                    {collectionId && currentCollection && (
                      <Field label="Uploading to Collection">
                        <Box
                          p={3}
                          bg="ui.main"
                          color="white"
                          borderRadius="md"
                          fontWeight="medium"
                        >
                          {currentCollection.name}
                        </Box>
                      </Field>
                    )}
                    
                    {/* Collection Selection - Only show if no collectionId is provided */}
                    {!collectionId && (
                      <Field
                        required
                        invalid={!!errors.collection_id}
                        errorText={errors.collection_id?.message}
                        label="Collection"
                      >
                        <select
                          {...register("collection_id", {
                            required: !collectionId ? "Please select a collection." : false,
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
                    )}

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
            <DialogActionTrigger asChild>
              <Button
                variant="subtle"
                colorPalette="gray"
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            </DialogActionTrigger>
            <Button
              variant="solid"
              type="submit"
              disabled={
                !watchedFile || 
                watchedFile.length === 0 || 
                !watch("title") || 
                (!collectionId && !watch("collection_id"))
              }
              loading={isSubmitting}
            >
              Upload Image
            </Button>
          </DialogFooter>
        </form>
        <DialogCloseTrigger />
      </DialogContent>
    </DialogRoot>
  )
}

export default AddItem
