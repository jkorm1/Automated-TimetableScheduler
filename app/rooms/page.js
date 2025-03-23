"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronLeft, Plus, Edit, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function RoomsPage() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [editingRoom, setEditingRoom] = useState(null)
  const [showAddDialog, setShowAddDialog] = useState(false)

  // New room form state
  const [newRoom, setNewRoom] = useState({
    name: "",
    type: "Lecture Hall",
    capacity: 50,
  })

  // Mock data for rooms
  const [rooms, setRooms] = useState([
    { id: 1, name: "Room 101", capacity: 50, type: "Lecture Hall", utilization: 90 },
    { id: 2, name: "Room 203", capacity: 40, type: "Lecture Hall", utilization: 75 },
    { id: 3, name: "Lab 3", capacity: 30, type: "Computer Lab", utilization: 95 },
    { id: 4, name: "Room 105", capacity: 60, type: "Lecture Hall", utilization: 50 },
    { id: 5, name: "Room 302", capacity: 45, type: "Lecture Hall", utilization: 85 },
    { id: 6, name: "Lab 2", capacity: 35, type: "Computer Lab", utilization: 70 },
    { id: 7, name: "Auditorium A", capacity: 120, type: "Lecture Hall", utilization: 40 },
    { id: 8, name: "Small Room 1", capacity: 20, type: "Seminar Room", utilization: 60 },
  ])

  // Mock data for courses that need rooms
  const courses = [
    { id: 1, name: "Discrete Mathematics", program: "Computer Science", students: 45 },
    { id: 2, name: "Operating Systems", program: "Computer Science", students: 38 },
    { id: 3, name: "Information Systems", program: "Computer Science", students: 28 },
    { id: 4, name: "Database Systems", program: "Computer Science", students: 50 },
    { id: 5, name: "Software Engineering", program: "Computer Science", students: 42 },
    { id: 6, name: "Computer Networks", program: "Computer Science", students: 35 },
  ]

  // Function to handle adding a new room
  const handleAddRoom = () => {
    const newId = Math.max(...rooms.map((room) => room.id)) + 1
    setRooms([...rooms, { ...newRoom, id: newId, utilization: 0 }])
    setNewRoom({ name: "", type: "Lecture Hall", capacity: 50 })
    setShowAddDialog(false)
  }

  // Function to handle editing a room
  const handleEditRoom = () => {
    setRooms(rooms.map((room) => (room.id === editingRoom.id ? editingRoom : room)))
    setEditingRoom(null)
  }

  // Function to handle deleting a room
  const handleDeleteRoom = (id) => {
    setRooms(rooms.filter((room) => room.id !== id))
  }

  // Filter rooms based on search query
  const filteredRooms = rooms.filter(
    (room) =>
      room.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      room.type.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  // Function to find suitable rooms for a course
  const findSuitableRooms = (course) => {
    return rooms.filter(
      (room) => room.capacity >= course.students && room.capacity <= course.students * 1.2, // Allow 20% buffer
    )
  }

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <div className="hidden md:flex flex-col w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
        <div className="p-6">
          <h2 className="text-2xl font-bold text-primary">UniScheduler</h2>
        </div>

        <div className="flex-1 px-4 space-y-2">
          <Button variant="ghost" className="w-full justify-start" onClick={() => router.push("/dashboard")}>
            <ChevronLeft className="mr-2 h-5 w-5" />
            Back to Dashboard
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Navigation */}
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div className="md:hidden">
              <Button variant="ghost" onClick={() => router.push("/dashboard")}>
                <ChevronLeft className="h-5 w-5 mr-2" />
                Back
              </Button>
            </div>

            <h1 className="text-xl font-bold">Room Management</h1>

            <div className="flex items-center space-x-2">
              <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Room
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Room</DialogTitle>
                    <DialogDescription>Enter the details for the new room.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="room-name">Room Name</Label>
                      <Input
                        id="room-name"
                        value={newRoom.name}
                        onChange={(e) => setNewRoom({ ...newRoom, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="room-type">Room Type</Label>
                      <Select value={newRoom.type} onValueChange={(value) => setNewRoom({ ...newRoom, type: value })}>
                        <SelectTrigger id="room-type">
                          <SelectValue placeholder="Select room type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Lecture Hall">Lecture Hall</SelectItem>
                          <SelectItem value="Computer Lab">Computer Lab</SelectItem>
                          <SelectItem value="Seminar Room">Seminar Room</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="room-capacity">Capacity</Label>
                      <Input
                        id="room-capacity"
                        type="number"
                        value={newRoom.capacity}
                        onChange={(e) => setNewRoom({ ...newRoom, capacity: Number.parseInt(e.target.value) })}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleAddRoom}>Add Room</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </header>

        {/* Rooms Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Tabs defaultValue="rooms">
            <TabsList className="mb-4">
              <TabsTrigger value="rooms">Room List</TabsTrigger>
              <TabsTrigger value="capacity">Capacity Analysis</TabsTrigger>
              <TabsTrigger value="utilization">Utilization</TabsTrigger>
            </TabsList>

            <TabsContent value="rooms">
              <Card>
                <CardHeader>
                  <CardTitle>All Rooms</CardTitle>
                  <CardDescription>Manage and view all available rooms</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mb-4">
                    <Input
                      placeholder="Search rooms..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="max-w-sm"
                    />
                  </div>

                  <div className="border rounded-md">
                    <div className="grid grid-cols-12 gap-4 p-4 font-medium border-b">
                      <div className="col-span-3">Room Name</div>
                      <div className="col-span-3">Type</div>
                      <div className="col-span-2">Capacity</div>
                      <div className="col-span-2">Utilization</div>
                      <div className="col-span-2">Actions</div>
                    </div>

                    {filteredRooms.map((room) => (
                      <div key={room.id} className="grid grid-cols-12 gap-4 p-4 border-b last:border-0">
                        <div className="col-span-3">{room.name}</div>
                        <div className="col-span-3">{room.type}</div>
                        <div className="col-span-2">{room.capacity} students</div>
                        <div className="col-span-2">
                          <div className="flex items-center space-x-2">
                            <Progress value={room.utilization} className="h-2 flex-1" />
                            <span className="text-sm">{room.utilization}%</span>
                          </div>
                        </div>
                        <div className="col-span-2 flex space-x-2">
                          <Button variant="ghost" size="icon" onClick={() => setEditingRoom(room)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteRoom(room.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Edit Room Dialog */}
              {editingRoom && (
                <Dialog open={!!editingRoom} onOpenChange={(open) => !open && setEditingRoom(null)}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Edit Room</DialogTitle>
                      <DialogDescription>Update the details for {editingRoom.name}.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="edit-room-name">Room Name</Label>
                        <Input
                          id="edit-room-name"
                          value={editingRoom.name}
                          onChange={(e) => setEditingRoom({ ...editingRoom, name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-room-type">Room Type</Label>
                        <Select
                          value={editingRoom.type}
                          onValueChange={(value) => setEditingRoom({ ...editingRoom, type: value })}
                        >
                          <SelectTrigger id="edit-room-type">
                            <SelectValue placeholder="Select room type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Lecture Hall">Lecture Hall</SelectItem>
                            <SelectItem value="Computer Lab">Computer Lab</SelectItem>
                            <SelectItem value="Seminar Room">Seminar Room</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-room-capacity">Capacity</Label>
                        <Input
                          id="edit-room-capacity"
                          type="number"
                          value={editingRoom.capacity}
                          onChange={(e) =>
                            setEditingRoom({ ...editingRoom, capacity: Number.parseInt(e.target.value) })
                          }
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setEditingRoom(null)}>
                        Cancel
                      </Button>
                      <Button onClick={handleEditRoom}>Save Changes</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </TabsContent>

            <TabsContent value="capacity">
              <Card>
                <CardHeader>
                  <CardTitle>Room Capacity Analysis</CardTitle>
                  <CardDescription>Find optimal rooms for each course based on student numbers</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {courses.map((course) => {
                      const suitableRooms = findSuitableRooms(course)

                      return (
                        <div key={course.id} className="border rounded-md p-4">
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <h3 className="font-medium">{course.name}</h3>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                {course.program} - {course.students} students
                              </p>
                            </div>
                            <Badge
                              variant="outline"
                              className={
                                suitableRooms.length === 0
                                  ? "bg-red-50 text-red-700 border-red-200"
                                  : suitableRooms.length < 2
                                    ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                                    : "bg-green-50 text-green-700 border-green-200"
                              }
                            >
                              {suitableRooms.length === 0
                                ? "No suitable rooms"
                                : suitableRooms.length === 1
                                  ? "1 suitable room"
                                  : `${suitableRooms.length} suitable rooms`}
                            </Badge>
                          </div>

                          {suitableRooms.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                              {suitableRooms.map((room) => (
                                <div key={room.id} className="border rounded p-2 flex justify-between items-center">
                                  <div>
                                    <p className="font-medium">{room.name}</p>
                                    <p className="text-xs text-gray-500">{room.capacity} capacity</p>
                                  </div>
                                  <Badge variant="outline">
                                    {Math.round((course.students / room.capacity) * 100)}% filled
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-md">
                              <p className="text-red-700 dark:text-red-400">
                                No rooms match the capacity requirements for this course.
                              </p>
                              <p className="text-sm text-red-600 dark:text-red-300 mt-1">
                                Consider splitting the class or finding a larger room.
                              </p>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="utilization">
              <Card>
                <CardHeader>
                  <CardTitle>Room Utilization</CardTitle>
                  <CardDescription>Analyze how efficiently rooms are being used</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {rooms.map((room) => (
                        <div key={room.id} className="border rounded-md p-4">
                          <div className="flex justify-between items-start mb-2">
                            <h3 className="font-medium">{room.name}</h3>
                            <Badge
                              variant="outline"
                              className={
                                room.utilization < 50
                                  ? "bg-red-50 text-red-700 border-red-200"
                                  : room.utilization < 75
                                    ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                                    : "bg-green-50 text-green-700 border-green-200"
                              }
                            >
                              {room.utilization < 50 ? "Underutilized" : room.utilization < 75 ? "Moderate" : "Optimal"}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-500 mb-2">
                            {room.type} - {room.capacity} students
                          </p>
                          <div className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span>Utilization</span>
                              <span>{room.utilization}%</span>
                            </div>
                            <Progress value={room.utilization} className="h-2" />
                          </div>
                        </div>
                      ))}
                    </div>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Utilization Summary</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                            <p className="text-sm font-medium text-green-700 dark:text-green-400">
                              Optimal Utilization
                            </p>
                            <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                              {rooms.filter((r) => r.utilization >= 75).length}
                            </p>
                            <p className="text-xs text-green-600 dark:text-green-300">
                              {Math.round((rooms.filter((r) => r.utilization >= 75).length / rooms.length) * 100)}% of
                              rooms
                            </p>
                          </div>

                          <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
                            <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
                              Moderate Utilization
                            </p>
                            <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">
                              {rooms.filter((r) => r.utilization >= 50 && r.utilization < 75).length}
                            </p>
                            <p className="text-xs text-yellow-600 dark:text-yellow-300">
                              {Math.round(
                                (rooms.filter((r) => r.utilization >= 50 && r.utilization < 75).length / rooms.length) *
                                  100,
                              )}
                              % of rooms
                            </p>
                          </div>

                          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
                            <p className="text-sm font-medium text-red-700 dark:text-red-400">Underutilized</p>
                            <p className="text-2xl font-bold text-red-700 dark:text-red-400">
                              {rooms.filter((r) => r.utilization < 50).length}
                            </p>
                            <p className="text-xs text-red-600 dark:text-red-300">
                              {Math.round((rooms.filter((r) => r.utilization < 50).length / rooms.length) * 100)}% of
                              rooms
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  )
}

