import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { format } from 'date-fns'
import {
  Calendar as CalendarIcon,
  Clock,
  Link as LinkIcon,
  MapPin,
  IndianRupeeIcon,
  X,
} from 'lucide-react'
import { cn } from '../lib/utils'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Textarea } from './ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'
import { Calendar } from './ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { TimePicker } from './ui/time-picker'
import { Badge } from './ui/badge'
import { Checkbox } from './ui/checkbox'
import { createUserEvent, updateUserEvent } from '../lib/server/user-events'
import { toast } from 'sonner'
import { getAllCategories, normalizeCategories, serializeCategories } from '../lib/utils/categorize-event'

interface EventFormProps {
  onSuccess?: () => void
  onCancel?: () => void
  submitButtonText?: string
  showCancelButton?: boolean
  initialValues?: {
    id?: string
    title?: string
    date?: string | Date
    time?: string
    link?: string
    description?: string
    category?: string | string[]
    venue?: string
    price?: string
    image?: string
    featured?: boolean
  }
  mode?: 'create' | 'edit'
  isAdmin?: boolean // Only admins can mark events as featured
}

export function EventForm({
  onSuccess,
  onCancel,
  submitButtonText = 'Submit Event',
  showCancelButton = true,
  initialValues,
  mode = 'create',
  isAdmin = false,
}: EventFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(
    initialValues?.image || null
  )

  // Parse initial date if provided
  const parseInitialDate = (dateValue?: string | Date): Date | undefined => {
    if (!dateValue) return undefined
    if (dateValue instanceof Date) return dateValue
    try {
      return new Date(dateValue)
    } catch {
      return undefined
    }
  }

  const form = useForm({
    defaultValues: {
      title: initialValues?.title || '',
      date: parseInitialDate(initialValues?.date),
      time: initialValues?.time || '',
      link: initialValues?.link || '',
      description: initialValues?.description || '',
      category: normalizeCategories(initialValues?.category) as string[],
      venue: initialValues?.venue || '',
      price: initialValues?.price || '',
      featured: initialValues?.featured || false,
    },
    onSubmit: async ({ value }) => {
      setIsSubmitting(true)

      try {
        const eventData: any = {
          title: value.title,
          date: value.date ? format(value.date, 'yyyy-MM-dd') : '',
          time: value.time,
          link: value.link,
          description: value.description || '',
          category: serializeCategories(value.category || []),
          venue: value.venue || '',
          price: value.price || '',
          featured: value.featured || false,
        }

        // For edit mode, include the ID and existing image
        if (mode === 'edit' && initialValues?.id) {
          eventData.id = initialValues.id
          eventData.image = initialValues.image || ''
        }

        // Add image data if new image was selected
        if (imageFile && imagePreview) {
          eventData.imageData = imagePreview
          eventData.imageFileName = imageFile.name
          eventData.imageType = imageFile.type
        }

        // @ts-ignore - Server function typing
        if (mode === 'edit') {
          await updateUserEvent({ data: eventData })
          toast.success('Event updated successfully!')
        } else {
          await createUserEvent({ data: eventData })
          toast.success('Event submitted for admin review!')
        }

        // Call success callback
        if (onSuccess) {
          onSuccess()
        }
      } catch (error) {
        console.error(`Failed to ${mode} event:`, error)
        toast.error(`Failed to ${mode} event. Please try again.`)
      } finally {
        setIsSubmitting(false)
      }
    },
  })

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImageFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
        form.handleSubmit()
      }}
      className="space-y-6"
    >
      {/* Title */}
      <form.Field
        name="title"
        validators={{
          onChange: ({ value }) => {
            if (!value || value.length < 3) {
              return 'Title must be at least 3 characters'
            }
            if (value.length > 200) {
              return 'Title is too long'
            }
            return undefined
          },
        }}
        children={(field) => (
          <div className="space-y-2">
            <Label htmlFor={field.name}>
              Event Title <span className="text-red-500">*</span>
            </Label>
            <Input
              id={field.name}
              name={field.name}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              placeholder="e.g., Tech Meetup 2025"
            />
            {field.state.meta.errors.length > 0 && (
              <p className="text-sm text-destructive">
                {field.state.meta.errors[0]}
              </p>
            )}
          </div>
        )}
      />

      {/* Featured Checkbox - Admin Only */}
      {isAdmin && (
        <form.Field
          name="featured"
          children={(field) => (
            <div className="flex items-center space-x-2 p-4 border rounded-lg bg-muted/50">
              <Checkbox
                id="featured"
                checked={field.state.value}
                onCheckedChange={(checked) => field.handleChange(checked as boolean)}
              />
              <div className="grid gap-1.5 leading-none">
                <label
                  htmlFor="featured"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  Feature this event
                </label>
                <p className="text-sm text-muted-foreground">
                  Featured events will be displayed prominently on the Featured Events page, grouped by category.
                </p>
              </div>
            </div>
          )}
        />
      )}

      {/* Date and Time */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Date Picker */}
        <form.Field
          name="date"
          validators={{
            onChange: ({ value }) => {
              if (!value) {
                return 'Please select a date for the event'
              }
              return undefined
            },
          }}
          children={(field) => (
            <div className="space-y-2">
              <Label>
                Date <span className="text-red-500">*</span>
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !field.state.value && 'text-muted-foreground',
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {field.state.value ? (
                      format(field.state.value, 'PPP')
                    ) : (
                      <span>Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={field.state.value}
                    onSelect={(date) => field.handleChange(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {field.state.meta.errors.length > 0 && (
                <p className="text-sm text-destructive">
                  {field.state.meta.errors[0]}
                </p>
              )}
            </div>
          )}
        />

        {/* Time */}
        <form.Field
          name="time"
          validators={{
            onChange: ({ value }) => {
              if (!value || value.length === 0) {
                return 'Time is required'
              }
              return undefined
            },
          }}
          children={(field) => (
            <div className="space-y-2">
              <Label>
                Time <span className="text-red-500">*</span>
              </Label>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <TimePicker
                  value={field.state.value}
                  onChange={(time) => field.handleChange(time)}
                  onBlur={field.handleBlur}
                  use12Hour={true}
                />
              </div>
              {field.state.meta.errors.length > 0 && (
                <p className="text-sm text-destructive">
                  {field.state.meta.errors[0]}
                </p>
              )}
            </div>
          )}
        />
      </div>

      {/* Venue */}
      <form.Field
        name="venue"
        children={(field) => (
          <div className="space-y-2">
            <Label htmlFor={field.name}>Venue</Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id={field.name}
                name={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="e.g., Koramangala, Bangalore"
                className="pl-10"
              />
            </div>
          </div>
        )}
      />

      {/* Categories */}
      <form.Field
        name="category"
        children={(field) => {
          const selectedCategories = field.state.value as string[]
          const availableCategories = getAllCategories()

          const toggleCategory = (category: string) => {
            const current = selectedCategories || []
            if (current.includes(category)) {
              field.handleChange(current.filter((c) => c !== category))
            } else {
              field.handleChange([...current, category])
            }
          }

          const removeCategory = (category: string) => {
            const current = selectedCategories || []
            field.handleChange(current.filter((c) => c !== category))
          }

          return (
            <div className="space-y-2">
              <Label>Categories (select one or more)</Label>

              {/* Selected categories as badges */}
              {selectedCategories && selectedCategories.length > 0 && (
                <div className="flex flex-wrap gap-2 p-2 border rounded-md">
                  {selectedCategories.map((cat) => (
                    <Badge key={cat} variant="secondary" className="gap-1">
                      {cat}
                      <X
                        className="h-3 w-3 cursor-pointer hover:text-destructive"
                        onClick={() => removeCategory(cat)}
                      />
                    </Badge>
                  ))}
                </div>
              )}

              {/* Available categories */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-3 border rounded-md max-h-60 overflow-y-auto">
                {availableCategories.filter(cat => cat !== 'Other').map((category) => (
                  <div key={category} className="flex items-center space-x-2">
                    <Checkbox
                      id={`category-${category}`}
                      checked={selectedCategories?.includes(category) || false}
                      onCheckedChange={() => toggleCategory(category)}
                    />
                    <label
                      htmlFor={`category-${category}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {category}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )
        }}
      />

      {/* Description */}
      <form.Field
        name="description"
        children={(field) => (
          <div className="space-y-2">
            <Label htmlFor={field.name}>Description</Label>
            <Textarea
              id={field.name}
              name={field.name}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              placeholder="Describe your event..."
              rows={5}
            />
          </div>
        )}
      />

      {/* Link */}
      <form.Field
        name="link"
        validators={{
          onChange: ({ value }) => {
            if (!value || value.length === 0) {
              return 'Event link is required'
            }
            try {
              new URL(value)
              return undefined
            } catch {
              return 'Please enter a valid URL'
            }
          },
        }}
        children={(field) => (
          <div className="space-y-2">
            <Label htmlFor={field.name}>
              Event Link/Registration <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id={field.name}
                name={field.name}
                type="url"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="https://..."
                className="pl-10"
              />
            </div>
            {field.state.meta.errors.length > 0 && (
              <p className="text-sm text-destructive">
                {field.state.meta.errors[0]}
              </p>
            )}
          </div>
        )}
      />

      {/* Price */}
      <form.Field
        name="price"
        children={(field) => (
          <div className="space-y-2">
            <Label htmlFor={field.name}>Price</Label>
            <div className="relative">
              <IndianRupeeIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id={field.name}
                name={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="Free, ₹500, etc."
                className="pl-10"
              />
            </div>
          </div>
        )}
      />

      {/* Image Upload */}
      <div className="space-y-2">
        <Label htmlFor="image">Event Image</Label>
        <Input
          id="image"
          name="image"
          type="file"
          accept="image/*"
          onChange={handleImageChange}
        />
        {imageFile && imagePreview ? (
          <div className="mt-2">
            <img
              src={imagePreview}
              alt="New preview"
              className="w-1/2 aspect-square object-cover rounded-lg"
            />
            <p className="text-sm text-muted-foreground mt-1">
              New image selected
            </p>
          </div>
        ) : initialValues?.image ? (
          <div className="mt-2">
            <img
              src={initialValues.image}
              alt="Current image"
              className="w-1/2 aspect-square object-cover rounded-lg"
            />
            <p className="text-sm text-muted-foreground mt-1">
              Current image (upload new to replace)
            </p>
          </div>
        ) : null}
        <p className="text-sm text-muted-foreground">
          {mode === 'edit'
            ? 'Upload a new image to replace the current one (please use a square image)'
            : 'Upload an image for your event (please use a square image)'}
        </p>
      </div>

      {/* Submit Buttons */}
      <div className="flex gap-4">
        <form.Subscribe
          selector={(state) => [state.canSubmit, state.isSubmitting]}
          children={([canSubmit, isSubmitting]) => (
            <Button
              type="submit"
              disabled={!canSubmit || isSubmitting}
              className="flex-1"
            >
              {isSubmitting ? 'Submitting...' : submitButtonText}
            </Button>
          )}
        />
        {showCancelButton && onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
        )}
      </div>
    </form>
  )
}
