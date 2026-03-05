import { AdminAppShell } from '@/components/layout/admin-app-shell'
import { cn } from "@/lib/utils"
import { useAdmin } from '@/contexts/admin-context'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, Plus, Edit, Trash2, Power, Database, Sprout, AlertTriangle, Loader2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { useQuery, useMutation } from "convex/react"
import { api } from "@convex/api"
import { Skeleton } from "@/components/ui/skeleton"
import { Id } from "@convex/dataModel"
import { Card } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

const locationSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  type: z.enum([
    "ups", "fedex", "usps", "dhl",
    "amazon_hub", "amazon_locker", "amazon_counter",
    "amazon_wholefoods", "amazon_kohls",
    "other"
  ]),
  address: z.string().min(5, "Address must be at least 5 characters"),
  address2: z.string().optional(),
  city: z.string().min(2, "City must be at least 2 characters"),
  state: z.string().length(2, "State must be 2 characters (e.g. GA)"),
  zipCode: z.string().min(5, "ZIP Code must be at least 5 characters"),
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
  hours: z.string().optional(),
  phone: z.string().optional(),
  notes: z.string().optional(),
  sortOrder: z.coerce.number().optional(),
})

const typeLabels: Record<string, string> = {
  ups: 'UPS Store',
  fedex: 'FedEx Office',
  usps: 'USPS',
  dhl: 'DHL',
  amazon_hub: 'Amazon Hub',
  amazon_locker: 'Amazon Locker',
  amazon_counter: 'Amazon Counter',
  amazon_wholefoods: 'Whole Foods (Amazon)',
  amazon_kohls: "Kohl's (Amazon)",
  other: 'Other',
}

const typeColors: Record<string, string> = {
  amazon_wholefoods: 'bg-green-500/20 text-green-400',
  amazon_kohls: 'bg-orange-500/20 text-orange-400',
  amazon_hub: 'bg-orange-500/20 text-orange-400',
  amazon_locker: 'bg-orange-500/20 text-orange-400',
  amazon_counter: 'bg-orange-500/20 text-orange-400',
  ups: 'bg-amber-500/20 text-amber-400',
  fedex: 'bg-purple-500/20 text-purple-400',
  usps: 'bg-blue-500/20 text-blue-400',
  dhl: 'bg-yellow-500/20 text-yellow-400',
  other: 'bg-slate-500/20 text-slate-400',
}

type LocationFormValues = z.infer<typeof locationSchema>

export default function AdminLocations() {
  const { isAdminLoggedIn } = useAdmin()
  const [search, setSearch] = useState('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingLocation, setEditingLocation] = useState<any | null>(null)
  const [locationToDelete, setLocationToDelete] = useState<Id<"hubLocations"> | null>(null)
  
  const locations = useQuery(api.hubLocations.listAllLocations, isAdminLoggedIn ? undefined : "skip")
  const createLocation = useMutation(api.hubLocations.createLocation)
  const updateLocation = useMutation(api.hubLocations.updateLocation)
  const deleteLocation = useMutation(api.hubLocations.deleteLocation)
  const seedLocations = useMutation(api.hubLocations.seedSampleLocations)
  const seedAtlantaHubs = useMutation(api.hubLocations.seedAtlantaReturnHubs)

  const [isSeeding, setIsSeeding] = useState(false)

  const handleSeedAtlanta = async () => {
    setIsSeeding(true)
    try {
      const result = await seedAtlantaHubs({})
      toast.success(result.message || `Seeded ${result.count} Atlanta hubs`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to seed hubs")
    } finally {
      setIsSeeding(false)
    }
  }

  const form = useForm<LocationFormValues>({
    resolver: zodResolver(locationSchema) as any,
    defaultValues: {
      name: "",
      type: "ups",
      address: "",
      address2: "",
      city: "",
      state: "",
      zipCode: "",
      latitude: undefined,
      longitude: undefined,
      hours: "",
      phone: "",
      notes: "",
      sortOrder: 0,
    },
  })

  const onSubmit = async (values: LocationFormValues) => {
    try {
      if (editingLocation) {
        await updateLocation({
          locationId: editingLocation._id,
          ...values,
        })
        toast.success("Location updated successfully")
      } else {
        await createLocation(values)
        toast.success("Location created successfully")
      }
      setIsDialogOpen(false)
      setEditingLocation(null)
      form.reset()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong")
    }
  }

  const handleEdit = (location: any) => {
    setEditingLocation(location)
    form.reset({
      name: location.name,
      type: location.type,
      address: location.address,
      address2: location.address2 || "",
      city: location.city,
      state: location.state,
      zipCode: location.zipCode,
      latitude: location.latitude,
      longitude: location.longitude,
      hours: location.hours || "",
      phone: location.phone || "",
      notes: location.notes || "",
      sortOrder: location.sortOrder || 0,
    })
    setIsDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!locationToDelete) return
    try {
      await deleteLocation({ locationId: locationToDelete })
      toast.success("Location deleted successfully")
      setLocationToDelete(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete location")
    }
  }

  const handleToggleActive = async (locationId: Id<"hubLocations">, currentStatus: boolean) => {
    try {
      await updateLocation({
        locationId,
        isActive: !currentStatus,
      })
      toast.success(`Location ${!currentStatus ? 'activated' : 'deactivated'}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update status")
    }
  }

  const handleSeed = async () => {
    try {
      const count = await seedLocations()
      toast.success(`Successfully seeded ${count} NYC locations`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to seed locations")
    }
  }

  const getTypeBadge = (type: string) => {
    const label = typeLabels[type] || type
    const colorClass = typeColors[type] || 'bg-slate-500/20 text-slate-400'
    return (
      <Badge className={cn("border-none", colorClass)}>
        {label}
      </Badge>
    )
  }

  const filteredLocations = locations?.filter(loc => 
    loc.name.toLowerCase().includes(search.toLowerCase()) ||
    loc.address.toLowerCase().includes(search.toLowerCase()) ||
    loc.city.toLowerCase().includes(search.toLowerCase())
  ) || []

  return (
    <AdminAppShell>
      <div className="space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight font-outfit">Drop-off Locations</h1>
              <p className="text-muted-foreground">Manage UPS, FedEx, Staples, and Amazon hub locations</p>
            </div>
            <div className="flex gap-4">
              {locations && locations.length === 0 && (
                <Button variant="outline" onClick={handleSeed}>
                  Seed NYC Locations
                </Button>
              )}
              <Button 
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => {
                  setEditingLocation(null)
                  form.reset({
                    name: "",
                    type: "ups",
                    address: "",
                    address2: "",
                    city: "",
                    state: "",
                    zipCode: "",
                    latitude: undefined,
                    longitude: undefined,
                    hours: "",
                    phone: "",
                    notes: "",
                    sortOrder: 0,
                  })
                  setIsDialogOpen(true)
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Location
              </Button>
            </div>
          </div>

          {/* Hub Status Card */}
          <Card className="mb-6 p-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <Database className="w-5 h-5" />
                  Hub Locations Status
                </h2>
                <div className="flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-1">
                    <span className="font-mono bg-slate-800 px-2 py-0.5 rounded">
                      {locations?.length ?? '...'}
                    </span>
                    total hubs
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="font-mono bg-green-500/20 text-green-500 px-2 py-0.5 rounded">
                      {locations?.filter(l => l.isActive)?.length ?? '...'}
                    </span>
                    active
                  </span>
                </div>
                {/* Environment info */}
                <p className="text-xs text-muted-foreground font-mono mt-2">
                  Backend: {import.meta.env.VITE_CONVEX_URL?.slice(0, 50)}...
                </p>
              </div>
              
              <div className="flex gap-2">
                <Button
                  variant={locations?.length === 0 ? "default" : "outline"}
                  onClick={handleSeedAtlanta}
                  disabled={isSeeding}
                  className={cn(
                    locations?.length === 0 && "animate-pulse"
                  )}
                >
                  {isSeeding ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Seeding...
                    </>
                  ) : (
                    <>
                      <Sprout className="w-4 h-4 mr-2" />
                      Seed Atlanta Hubs
                    </>
                  )}
                </Button>
              </div>
            </div>
            
            {/* Warning if no hubs */}
            {locations && locations.length === 0 && (
              <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-yellow-500">No Hub Locations Found</p>
                  <p className="text-sm text-muted-foreground">
                    The drop-off location list will be empty for customers. Click "Seed Atlanta Hubs" to add default locations.
                  </p>
                </div>
              </div>
            )}
          </Card>

          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search by name, address, or city..." 
                className="pl-10 bg-card"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="border border-border rounded-xl overflow-hidden bg-card">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[80px]">Sort</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>City, State</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {locations === undefined ? (
                  [1, 2, 3, 4, 5].map(i => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-8" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-60" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-30" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredLocations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-64 text-center text-muted-foreground">
                      No locations found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLocations.map((location) => (
                    <TableRow key={location._id}>
                      <TableCell className="text-muted-foreground">{location.sortOrder || 0}</TableCell>
                      <TableCell className="font-medium">{location.name}</TableCell>
                      <TableCell>{getTypeBadge(location.type)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {location.address}
                        {location.address2 && <span className="block text-xs">{location.address2}</span>}
                      </TableCell>
                      <TableCell>{location.city}, {location.state}</TableCell>
                      <TableCell>
                        <Badge variant={location.isActive ? "default" : "secondary"}>
                          {location.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleToggleActive(location._id, location.isActive)}
                            title={location.isActive ? "Deactivate" : "Activate"}
                          >
                            <Power className={location.isActive ? "h-4 w-4 text-primary" : "h-4 w-4 text-muted-foreground"} />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleEdit(location)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => setLocationToDelete(location._id)}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Add/Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-outfit text-2xl">
                {editingLocation ? "Edit Location" : "Add New Location"}
              </DialogTitle>
              <DialogDescription>
                Enter the details for the drop-off location.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. The UPS Store #1234" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select location type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(typeLabels).map(([value, label]) => (
                              <SelectItem key={value} value={value}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Address</FormLabel>
                        <FormControl>
                          <Input placeholder="123 Main St" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="address2"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Apt/Suite/Unit (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="Suite 100" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <Input placeholder="New York" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="state"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>State</FormLabel>
                          <FormControl>
                            <Input placeholder="NY" maxLength={2} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="zipCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>ZIP Code</FormLabel>
                          <FormControl>
                            <Input placeholder="10001" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="latitude"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Latitude (Optional)</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.000001" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="longitude"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Longitude (Optional)</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.000001" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <p className="text-[0.8rem] text-muted-foreground italic">
                      Coordinates are optional for manual entry.
                    </p>
                  </div>
                  <FormField
                    control={form.control}
                    name="sortOrder"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Sort Order</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="(212) 555-0101" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="hours"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Hours (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="Mon-Fri 8am-7pm" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Notes (Optional)</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Additional details..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <DialogFooter className="pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" className="bg-primary text-primary-foreground">
                    {editingLocation ? "Update Location" : "Create Location"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={!!locationToDelete} onOpenChange={(open) => !open && setLocationToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the location from the directory.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </AdminAppShell>
  )
}
