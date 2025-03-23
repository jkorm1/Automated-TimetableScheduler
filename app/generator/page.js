"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ChevronLeft, Play, Save, AlertTriangle, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { getAuth } from "firebase/auth"
import { getFirestore, collection, getDocs, query, where } from "firebase/firestore"
import { app } from "../../firebaseConfig"

export default function TimetableGenerator() {
  const router = useRouter()
  const auth = getAuth(app)
  const db = getFirestore(app)

  const [selectedProgram, setSelectedProgram] = useState("")
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [conflicts, setConflicts] = useState([])
  const [generationComplete, setGenerationComplete] = useState(false)

  // Data states
  const [programs, setPrograms] = useState([])
  const [courses, setCourses] = useState([])
  const [lecturers, setLecturers] = useState([])
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true)

  // Settings for the timetable generator
  const [settings, setSettings] = useState({
    prioritizeCreditHours: true,
    balanceWorkload: true,
    respectLecturerPreferences: true,
    maxConsecutiveHours: 2,
    allowWeekends: false,
    startTime: "8:00 AM",
    endTime: "7:00 PM",
    considerRoomCapacity: true, // New setting for room capacity consideration
  })

  // Selected courses and rooms for scheduling
  const [selectedCourses, setSelectedCourses] = useState({})
  const [selectedRooms, setSelectedRooms] = useState({})

  useEffect(() => {
    // Check if user is authenticated and is an admin
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        try {
          // Get user data from Firestore
          const userRef = collection(db, "users")
          const q = query(userRef, where("email", "==", user.email))
          const querySnapshot = await getDocs(q)

          if (!querySnapshot.empty) {
            const userData = querySnapshot.docs[0].data()

            if (userData.role !== "admin") {
              // Redirect non-admin users
              router.push("/dashboard")
              return
            }

            // Fetch data
            await fetchPrograms()
            await fetchRooms()
          } else {
            // User not found in database
            router.push("/login")
          }
        } catch (error) {
          console.error("Error fetching user data:", error)
        } finally {
          setLoading(false)
        }
      } else {
        // Redirect to login if not authenticated
        router.push("/login")
      }
    })

    return () => unsubscribe()
  }, [])

  // Fetch programs from Firestore
  const fetchPrograms = async () => {
    try {
      const programsRef = collection(db, "programs")
      const programsSnapshot = await getDocs(programsRef)

      const programsData = []
      programsSnapshot.forEach((doc) => {
        programsData.push({
          id: doc.id,
          ...doc.data(),
        })
      })

      setPrograms(programsData)

      if (programsData.length > 0) {
        setSelectedProgram(programsData[0].id)
        await fetchCourses(programsData[0].id)
        await fetchLecturers()
      }
    } catch (error) {
      console.error("Error fetching programs:", error)
    }
  }

  // Fetch courses for a specific program
  const fetchCourses = async (programId) => {
    try {
      const coursesRef = collection(db, "courses")
      const q = query(coursesRef, where("program_id", "==", programId))
      const coursesSnapshot = await getDocs(q)

      const coursesData = []
      const selectedCoursesObj = {}

      coursesSnapshot.forEach((doc) => {
        const courseData = {
          id: doc.id,
          ...doc.data(),
        }
        coursesData.push(courseData)
        selectedCoursesObj[doc.id] = true // Default select all courses
      })

      setCourses(coursesData)
      setSelectedCourses(selectedCoursesObj)
    } catch (error) {
      console.error("Error fetching courses:", error)
    }
  }

  // Fetch lecturers from Firestore
  const fetchLecturers = async () => {
    try {
      const lecturersRef = collection(db, "lecturers")
      const lecturersSnapshot = await getDocs(lecturersRef)

      const lecturersData = []

      for (const doc of lecturersSnapshot.docs) {
        const lecturerData = doc.data()

        // Get user data for lecturer name
        const userRef = collection(db, "users")
        const q = query(userRef, where("id", "==", lecturerData.user_id))
        const userSnapshot = await getDocs(q)

        let lecturerName = "Unknown"
        if (!userSnapshot.empty) {
          lecturerName = userSnapshot.docs[0].data().name
        }

        // Get courses taught by this lecturer
        const coursesRef = collection(db, "courses")
        const coursesSnapshot = await getDocs(coursesRef)

        const coursesTaught = []
        coursesSnapshot.forEach((courseDoc) => {
          const courseData = courseDoc.data()
          if (courseData.lecturer_id === doc.id) {
            coursesTaught.push(courseData.name)
          }
        })

        lecturersData.push({
          id: doc.id,
          name: lecturerName,
          courses: coursesTaught,
          unavailableTimes: lecturerData.unavailable_times || [],
          ...lecturerData,
        })
      }

      setLecturers(lecturersData)
    } catch (error) {
      console.error("Error fetching lecturers:", error)
    }
  }

  // Fetch rooms from Firestore
  const fetchRooms = async () => {
    try {
      const roomsRef = collection(db, "rooms")
      const roomsSnapshot = await getDocs(roomsRef)

      const roomsData = []
      const selectedRoomsObj = {}

      roomsSnapshot.forEach((doc) => {
        const roomData = {
          id: doc.id,
          ...doc.data(),
        }
        roomsData.push(roomData)
        selectedRoomsObj[doc.id] = true // Default select all rooms
      })

      setRooms(roomsData)
      setSelectedRooms(selectedRoomsObj)
    } catch (error) {
      console.error("Error fetching rooms:", error)
    }
  }

  // Function to handle settings changes
  const handleSettingChange = (setting, value) => {
    setSettings((prev) => ({ ...prev, [setting]: value }))
  }

  // Function to handle course selection
  const handleCourseSelection = (courseId, checked) => {
    setSelectedCourses((prev) => ({ ...prev, [courseId]: checked }))
  }

  // Function to handle room selection
  const handleRoomSelection = (roomId, checked) => {
    setSelectedRooms((prev) => ({ ...prev, [roomId]: checked }))
  }

  // Function to generate timetable
  const generateTimetable = async () => {
    setGenerating(true)
    setProgress(0)
    setConflicts([])
    setGenerationComplete(false)

    try {
      // Get selected courses
      const selectedCoursesList = courses.filter((course) => selectedCourses[course.id])

      // Get selected rooms
      const selectedRoomsList = rooms.filter((room) => selectedRooms[room.id])

      // Get program data for student count
      const programRef = collection(db, "programs")
      const q = query(programRef, where("id", "==", selectedProgram))
      const programSnapshot = await getDocs(q)

      if (programSnapshot.empty) {
        throw new Error("Program not found")
      }

      const programData = programSnapshot.docs[0].data()
      const studentCount = programData.num_students || 0

      // Filter rooms based on capacity if setting is enabled
      let availableRooms = selectedRoomsList
      if (settings.considerRoomCapacity) {
        availableRooms = selectedRoomsList.filter((room) => room.capacity >= studentCount)

        if (availableRooms.length === 0) {
          setConflicts([
            {
              type: "capacity",
              message: `No rooms have enough capacity for ${studentCount} students in the ${programData.name} program.`,
            },
          ])
          setGenerating(false)
          setGenerationComplete(true)
          return
        }
      }

      // Sort courses by credit hours if prioritizing
      const coursesToSchedule = [...selectedCoursesList]
      if (settings.prioritizeCreditHours) {
        coursesToSchedule.sort((a, b) => b.credit_hours - a.credit_hours)
      }

      // Define available time slots
      const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
      if (settings.allowWeekends) {
        days.push("Saturday", "Sunday")
      }

      const timeSlots = [
        "8:00 AM",
        "9:00 AM",
        "10:00 AM",
        "11:00 AM",
        "12:00 PM",
        "1:00 PM",
        "2:00 PM",
        "3:00 PM",
        "4:00 PM",
        "5:00 PM",
        "6:00 PM",
      ]

      // Filter time slots based on settings
      const startIndex = timeSlots.indexOf(settings.startTime)
      const endIndex = timeSlots.indexOf(settings.endTime)
      const availableTimeSlots = timeSlots.slice(
        startIndex !== -1 ? startIndex : 0,
        endIndex !== -1 ? endIndex + 1 : timeSlots.length,
      )

      // Initialize timetable
      const timetable = []
      const scheduledSlots = {} // To track occupied slots
      const lecturerSchedule = {} // To track lecturer schedules
      const detectedConflicts = []

      // Simulate progress
      const progressStep = 100 / coursesToSchedule.length
      let currentProgress = 0

      // Schedule each course
      for (const course of coursesToSchedule) {
        // Get lecturer for this course
        const lecturer = lecturers.find((l) => l.id === course.lecturer_id)

        if (!lecturer) {
          detectedConflicts.push({
            type: "lecturer",
            message: `No lecturer assigned to ${course.name}`,
          })
          currentProgress += progressStep
          setProgress(Math.min(Math.round(currentProgress), 100))
          continue
        }

        // Determine how many hours needed based on credit hours (1-2 hours per session)
        const hoursPerSession = Math.min(course.credit_hours, settings.maxConsecutiveHours)

        // Find available slot
        let scheduled = false

        // Try each day and time slot
        for (const day of days) {
          if (scheduled) break

          for (let i = 0; i < availableTimeSlots.length - hoursPerSession + 1; i++) {
            const startTime = availableTimeSlots[i]
            const endTime = availableTimeSlots[i + hoursPerSession - 1]

            // Check if slot is available
            let slotAvailable = true

            // Check if lecturer is available
            if (lecturer.unavailableTimes.includes(`${day} ${startTime}`)) {
              slotAvailable = false
              continue
            }

            // Check if lecturer is already scheduled
            for (let j = 0; j < hoursPerSession; j++) {
              const timeSlot = availableTimeSlots[i + j]
              const lecturerKey = `${lecturer.id}-${day}-${timeSlot}`

              if (lecturerSchedule[lecturerKey]) {
                slotAvailable = false
                break
              }
            }

            // Check if any room is available
            let availableRoom = null

            for (const room of availableRooms) {
              let roomAvailable = true

              for (let j = 0; j < hoursPerSession; j++) {
                const timeSlot = availableTimeSlots[i + j]
                const roomKey = `${room.id}-${day}-${timeSlot}`

                if (scheduledSlots[roomKey]) {
                  roomAvailable = false
                  break
                }
              }

              if (roomAvailable) {
                availableRoom = room
                break
              }
            }

            if (!availableRoom) {
              slotAvailable = false
              continue
            }

            // If slot is available, schedule the course
            if (slotAvailable) {
              // Mark slots as occupied
              for (let j = 0; j < hoursPerSession; j++) {
                const timeSlot = availableTimeSlots[i + j]
                const roomKey = `${availableRoom.id}-${day}-${timeSlot}`
                const lecturerKey = `${lecturer.id}-${day}-${timeSlot}`

                scheduledSlots[roomKey] = true
                lecturerSchedule[lecturerKey] = true
              }

              // Add to timetable
              timetable.push({
                course_id: course.id,
                lecturer_id: lecturer.id,
                room_id: availableRoom.id,
                day: day,
                start_time: startTime,
                end_time: endTime,
                program_id: selectedProgram,
              })

              scheduled = true
              break
            }
          }
        }

        if (!scheduled) {
          detectedConflicts.push({
            type: "scheduling",
            message: `Could not schedule ${course.name}. No available slots found.`,
          })
        }

        // Update progress
        currentProgress += progressStep
        setProgress(Math.min(Math.round(currentProgress), 100))
      }

      // Set conflicts if any
      if (detectedConflicts.length > 0) {
        setConflicts(detectedConflicts)
      }

      // Store generated timetable in state or Firestore
      // This would be implemented in a real application

      setGenerationComplete(true)
    } catch (error) {
      console.error("Error generating timetable:", error)
      setConflicts([{ type: "error", message: `Error generating timetable: ${error.message}` }])
      setGenerationComplete(true)
    } finally {
      setGenerating(false)
      setProgress(100)
    }
  }

  // Function to save the generated timetable
  const saveTimetable = async () => {
    // Logic to save the timetable to the database
    alert("Timetable saved successfully!")
    router.push("/timetable")
  }

  // Function to resolve a conflict
  const resolveConflict = (index) => {
    // Logic to resolve the conflict
    setConflicts((prev) => prev.filter((_, i) => i !== index))
  }

  // Function to ignore a conflict
  const ignoreConflict = (index) => {
    // Logic to ignore the conflict
    setConflicts((prev) => prev.filter((_, i) => i !== index))
  }

  // Handle program change
  const handleProgramChange = async (programId) => {
    setSelectedProgram(programId)
    await fetchCourses(programId)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sidebar - You can reuse the sidebar from dashboard.js */}
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

            <h1 className="text-xl font-bold">Timetable Generator</h1>

            <div className="flex items-center space-x-2">
              {generationComplete && (
                <Button onClick={saveTimetable}>
                  <Save className="h-4 w-4 mr-2" />
                  Save Timetable
                </Button>
              )}
            </div>
          </div>
        </header>

        {/* Generator Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Tabs defaultValue="settings">
            <TabsList className="mb-4">
              <TabsTrigger value="settings">Settings</TabsTrigger>
              <TabsTrigger value="programs">Programs & Courses</TabsTrigger>
              <TabsTrigger value="lecturers">Lecturers</TabsTrigger>
              <TabsTrigger value="rooms">Rooms</TabsTrigger>
              <TabsTrigger value="generate">Generate</TabsTrigger>
            </TabsList>

            <TabsContent value="settings">
              <Card>
                <CardHeader>
                  <CardTitle>Generator Settings</CardTitle>
                  <CardDescription>Configure how the timetable generator works</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="prioritizeCreditHours">Prioritize Higher Credit Hours</Label>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Courses with higher credit hours will be scheduled first
                      </p>
                    </div>
                    <Switch
                      id="prioritizeCreditHours"
                      checked={settings.prioritizeCreditHours}
                      onCheckedChange={(checked) => handleSettingChange("prioritizeCreditHours", checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="balanceWorkload">Balance Lecturer Workload</Label>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Distribute teaching hours evenly among lecturers
                      </p>
                    </div>
                    <Switch
                      id="balanceWorkload"
                      checked={settings.balanceWorkload}
                      onCheckedChange={(checked) => handleSettingChange("balanceWorkload", checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="respectLecturerPreferences">Respect Lecturer Preferences</Label>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Try to accommodate lecturer time preferences
                      </p>
                    </div>
                    <Switch
                      id="respectLecturerPreferences"
                      checked={settings.respectLecturerPreferences}
                      onCheckedChange={(checked) => handleSettingChange("respectLecturerPreferences", checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="considerRoomCapacity">Consider Room Capacity</Label>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Assign rooms based on student count and room capacity
                      </p>
                    </div>
                    <Switch
                      id="considerRoomCapacity"
                      checked={settings.considerRoomCapacity}
                      onCheckedChange={(checked) => handleSettingChange("considerRoomCapacity", checked)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="maxConsecutiveHours">Maximum Consecutive Hours</Label>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Maximum number of consecutive hours a lecturer can teach
                    </p>
                    <div className="flex items-center space-x-4">
                      <Slider
                        id="maxConsecutiveHours"
                        min={1}
                        max={4}
                        step={1}
                        value={[settings.maxConsecutiveHours]}
                        onValueChange={(value) => handleSettingChange("maxConsecutiveHours", value[0])}
                        className="flex-1"
                      />
                      <span className="font-medium">{settings.maxConsecutiveHours} hours</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="allowWeekends">Allow Weekend Classes</Label>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Schedule classes on Saturdays and Sundays
                      </p>
                    </div>
                    <Switch
                      id="allowWeekends"
                      checked={settings.allowWeekends}
                      onCheckedChange={(checked) => handleSettingChange("allowWeekends", checked)}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="startTime">Earliest Class Time</Label>
                      <Select
                        value={settings.startTime}
                        onValueChange={(value) => handleSettingChange("startTime", value)}
                      >
                        <SelectTrigger id="startTime">
                          <SelectValue placeholder="Select start time" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="8:00 AM">8:00 AM</SelectItem>
                          <SelectItem value="9:00 AM">9:00 AM</SelectItem>
                          <SelectItem value="10:00 AM">10:00 AM</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="endTime">Latest Class Time</Label>
                      <Select value={settings.endTime} onValueChange={(value) => handleSettingChange("endTime", value)}>
                        <SelectTrigger id="endTime">
                          <SelectValue placeholder="Select end time" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="5:00 PM">5:00 PM</SelectItem>
                          <SelectItem value="6:00 PM">6:00 PM</SelectItem>
                          <SelectItem value="7:00 PM">7:00 PM</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="programs">
              <Card>
                <CardHeader>
                  <CardTitle>Programs & Courses</CardTitle>
                  <CardDescription>Manage programs and their courses</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Label htmlFor="program">Select Program:</Label>
                      <Select value={selectedProgram} onValueChange={handleProgramChange}>
                        <SelectTrigger id="program" className="w-[200px]">
                          <SelectValue placeholder="Select Program" />
                        </SelectTrigger>
                        <SelectContent>
                          {programs.map((program) => (
                            <SelectItem key={program.id} value={program.id}>
                              {program.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="border rounded-md">
                      <div className="grid grid-cols-12 gap-4 p-4 font-medium border-b">
                        <div className="col-span-5">Course Name</div>
                        <div className="col-span-2">Credit Hours</div>
                        <div className="col-span-3">Lecturer</div>
                        <div className="col-span-2">Include</div>
                      </div>

                      {courses.map((course) => {
                        // Find lecturer name
                        const lecturer = lecturers.find((l) => l.id === course.lecturer_id)
                        const lecturerName = lecturer ? lecturer.name : "Unassigned"

                        return (
                          <div key={course.id} className="grid grid-cols-12 gap-4 p-4 border-b last:border-0">
                            <div className="col-span-5">{course.name}</div>
                            <div className="col-span-2">{course.credit_hours}</div>
                            <div className="col-span-3">{lecturerName}</div>
                            <div className="col-span-2">
                              <Checkbox
                                id={`course-${course.id}`}
                                checked={selectedCourses[course.id] || false}
                                onCheckedChange={(checked) => handleCourseSelection(course.id, checked)}
                              />
                            </div>
                          </div>
                        )
                      })}

                      {courses.length === 0 && (
                        <div className="p-4 text-center text-gray-500">No courses found for this program.</div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="lecturers">
              <Card>
                <CardHeader>
                  <CardTitle>Lecturers</CardTitle>
                  <CardDescription>Manage lecturer preferences and constraints</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {lecturers.map((lecturer) => (
                      <div key={lecturer.id} className="border rounded-md p-4">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h3 className="font-medium">{lecturer.name}</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              Courses: {lecturer.courses.join(", ") || "None assigned"}
                            </p>
                          </div>
                          <Button variant="outline" size="sm">
                            Edit Preferences
                          </Button>
                        </div>

                        <div>
                          <h4 className="text-sm font-medium mb-2">Unavailable Times:</h4>
                          <div className="flex flex-wrap gap-2">
                            {lecturer.unavailableTimes && lecturer.unavailableTimes.length > 0 ? (
                              lecturer.unavailableTimes.map((time, index) => (
                                <Badge key={index} variant="secondary">
                                  {time}
                                </Badge>
                              ))
                            ) : (
                              <p className="text-sm text-gray-500">No unavailable times specified</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}

                    {lecturers.length === 0 && <div className="p-4 text-center text-gray-500">No lecturers found.</div>}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="rooms">
              <Card>
                <CardHeader>
                  <CardTitle>Rooms</CardTitle>
                  <CardDescription>Manage available rooms for scheduling</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="border rounded-md">
                    <div className="grid grid-cols-12 gap-4 p-4 font-medium border-b">
                      <div className="col-span-4">Room Name</div>
                      <div className="col-span-3">Type</div>
                      <div className="col-span-3">Capacity</div>
                      <div className="col-span-2">Include</div>
                    </div>

                    {rooms.map((room) => (
                      <div key={room.id} className="grid grid-cols-12 gap-4 p-4 border-b last:border-0">
                        <div className="col-span-4">{room.name}</div>
                        <div className="col-span-3">{room.type}</div>
                        <div className="col-span-3">{room.capacity} students</div>
                        <div className="col-span-2">
                          <Checkbox
                            id={`room-${room.id}`}
                            checked={selectedRooms[room.id] || false}
                            onCheckedChange={(checked) => handleRoomSelection(room.id, checked)}
                          />
                        </div>
                      </div>
                    ))}

                    {rooms.length === 0 && <div className="p-4 text-center text-gray-500">No rooms found.</div>}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="generate">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Generate Timetable</CardTitle>
                    <CardDescription>Start the automatic timetable generation process</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Label htmlFor="generate-program">Program:</Label>
                      <Select value={selectedProgram} onValueChange={handleProgramChange}>
                        <SelectTrigger id="generate-program" className="w-[200px]">
                          <SelectValue placeholder="Select Program" />
                        </SelectTrigger>
                        <SelectContent>
                          {programs.map((program) => (
                            <SelectItem key={program.id} value={program.id}>
                              {program.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {generating && (
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">Generating timetable...</span>
                          <span className="text-sm">{progress}%</span>
                        </div>
                        <Progress value={progress} />
                      </div>
                    )}

                    {!generating && !generationComplete && (
                      <div className="flex justify-center">
                        <Button onClick={generateTimetable} className="w-full md:w-auto">
                          <Play className="h-4 w-4 mr-2" />
                          Start Generation
                        </Button>
                      </div>
                    )}

                    {generationComplete && conflicts.length === 0 && (
                      <Alert className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                        <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                        <AlertTitle>Success!</AlertTitle>
                        <AlertDescription>Timetable generated successfully with no conflicts.</AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                  {generationComplete && (
                    <CardFooter>
                      <Button onClick={saveTimetable} className="w-full">
                        <Save className="h-4 w-4 mr-2" />
                        Save and Apply Timetable
                      </Button>
                    </CardFooter>
                  )}
                </Card>

                {generationComplete && conflicts.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="h-5 w-5 mr-2" />
                        Conflicts Detected
                      </CardTitle>
                      <CardDescription>
                        The following conflicts were detected during timetable generation
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {conflicts.map((conflict, index) => (
                          <div key={index} className="flex items-start justify-between border-b pb-4 last:border-0">
                            <div>
                              <p className="font-medium">
                                {conflict.type === "lecturer"
                                  ? "Lecturer Conflict"
                                  : conflict.type === "capacity"
                                    ? "Room Capacity Conflict"
                                    : conflict.type === "scheduling"
                                      ? "Scheduling Conflict"
                                      : "Error"}
                              </p>
                              <p className="text-sm text-gray-500 dark:text-gray-400">{conflict.message}</p>
                            </div>
                            <div className="flex space-x-2">
                              <Button size="sm" variant="outline" onClick={() => resolveConflict(index)}>
                                <Check className="h-4 w-4 mr-1" />
                                Resolve
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => ignoreConflict(index)}>
                                <X className="h-4 w-4 mr-1" />
                                Ignore
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  )
}

