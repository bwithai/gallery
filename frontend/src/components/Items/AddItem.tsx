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
  collection_id: string
  file: FileList
}

const AddItem = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const { showSuccessToast } = useCustomToast()
  
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isValid, isSubmitting },
  } = useForm<UploadFormData>({
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: {
      title: "",
      description: "",
      alt_text: "",
      collection_id: "",
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
      formData.append("collection_id", data.collection_id)
      if (data.description) formData.append("description", data.description)
      if (data.alt_text) formData.append("alt_text", data.alt_text)
      
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
    onSuccess: () => {
      showSuccessToast("Image uploaded successfully!")
      reset()
      setPreview(null)
      setIsOpen(false)
    },
    onError: (err: any) => {
      handleError(err)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] })
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

  return (
    <DialogRoot
      size={{ base: "xs", md: "md" }}
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
            <Text mb={4}>Upload an image to your gallery.</Text>
            <VStack gap={4}>
              {/* File Upload */}
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

              {/* Image Preview */}
              {preview && (
                <Box>
                  <Text fontSize="sm" mb={2} fontWeight="medium">
                    Preview:
                  </Text>
                  <AspectRatio ratio={4 / 3} maxW="200px">
                    <Image
                      src={preview}
                      alt="Preview"
                      objectFit="cover"
                      borderRadius="md"
                      border="1px solid"
                      borderColor="gray.200"
                    />
                  </AspectRatio>
                </Box>
              )}

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

              {/* Description */}
              <Field
                invalid={!!errors.description}
                errorText={errors.description?.message}
                label="Description"
              >
                <Textarea
                  id="description"
                  {...register("description")}
                  placeholder="Describe your image (optional)"
                  rows={3}
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
              disabled={!isValid || !watchedFile || watchedFile.length === 0}
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
