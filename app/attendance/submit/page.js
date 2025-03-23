"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ChevronLeft, QrCode, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { getAuth } from "firebase/auth"
import { getFirestore, collection, getDocs, query, where, addDoc, doc, getDoc } from "firebase/firestore"
import { app } from "../../../firebaseConfig"

export default function SubmitAttendancePage() {
  const router = useRouter()
  const auth = getAuth(app)
  const db = getFirestore(app)

  const [selectedCourse, setSelectedCourse] = useState("")
  const [attendanceCode, setAttendanceCode] = useState("")
  const [showScanner, setShowScanner] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState("")
  const [activeCourses, setActiveCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [userLocation, setUserLocation] = useState(null)

  useEffect(() => {
    // Check if user is authenticated and is a student
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        try {
          // Get user data from Firestore
          const userRef = collection(db, "users")
          const q = query(userRef, where("email", "==", user.email))
          const querySnapshot = await getDocs(q)

          if (!querySnapshot.empty) {
            const userData = querySnapshot.docs[0].data()

            if (userData.role !== "student") {
              // Redirect non-student users
              router.push("/dashboard")
              return
            }

            // Get student's program
            const studentRef = collection(db, "students")
            const studentQuery = query(studentRef, where("user_id", "==", user.uid))
            const studentSnapshot = await getDocs(studentQuery)

            if (!studentSnapshot.empty) {
              const studentData = studentSnapshot.docs[0].data()

              // Get active attendance sessions for student's program
              await fetchActiveCourses(studentData.program_id)
            }
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

    // Get user's location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          })
        },
        (error) => {
          console.error("Error getting location:", error)
          setError("Please enable location services to submit attendance.")
        },
      )
    } else {
      setError("Geolocation is not supported by this browser.")
    }

    return () => unsubscribe()
  }, [])

  // Fetch active courses with attendance sessions
  const fetchActiveCourses = async (programId) => {
    try {
      // Get current day and time
      const now = new Date()
      const dayOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][now.getDay()]

      // Get timetable entries for today
      const timetableRef = collection(db, "timetable")
      const timetableQuery = query(timetableRef, where("program_id", "==", programId), where("day", "==", dayOfWeek))
      const timetableSnapshot = await getDocs(timetableQuery)

      // Check active attendance sessions
      const sessionsRef = collection(db, "attendance_sessions")
      const activeSessionsQuery = query(sessionsRef, where("is_active", "==", true))
      const activeSessionsSnapshot = await getDocs(activeSessionsQuery)

      const activeSessions = {}
      activeSessionsSnapshot.forEach((doc) => {
        activeSessions[doc.data().timetable_id] = doc.data()
      })

      const courses = []

      for (const doc of timetableSnapshot.docs) {
        const timetableData = doc.data()

        // Check if there's an active session for this timetable entry
        if (activeSessions[doc.id]) {
          // Get course details
          const courseRef = doc(db, "courses", timetableData.course_id)
          const courseSnapshot = await getDoc(courseRef)

          // Get room details
          const roomRef = doc(db, "rooms", timetableData.room_id)
          const roomSnapshot = await getDoc(roomRef)

          // Get lecturer details
          const lecturerRef = doc(db, "lecturers", timetableData.lecturer_id)
          const lecturerSnapshot = await getDoc(lecturerRef)

          if (courseSnapshot.exists() && roomSnapshot.exists() && lecturerSnapshot.exists()) {
            const courseData = courseSnapshot.data()
            const roomData = roomSnapshot.data()

            // Get lecturer's user data
            const lecturerData = lecturerSnapshot.data()
            const userRef = doc(db, "users", lecturerData.user_id)
            const userSnapshot = await getDoc(userRef)

            let lecturerName = "Unknown"
            if (userSnapshot.exists()) {
              lecturerName = userSnapshot.data().name
            }

            courses.push({
              id: doc.id,
              name: courseData.name,
              time: `${timetableData.start_time} - ${timetableData.end_time}`,
              room: roomData.name,
              lecturer: lecturerName,
              sessionId: Object.keys(activeSessions).find((key) => key === doc.id),
              roomLocation: roomData.location || null,
            })
          }
        }
      }

      setActiveCourses(courses)
    } catch (error) {
      console.error("Error fetching active courses:", error)
    }
  }

  // Function to handle attendance submission
  const submitAttendance = async () => {
    if (!selectedCourse) {
      setError("Please select a course")
      return
    }

    if (!attendanceCode && !showScanner) {
      setError("Please enter the attendance code or scan the QR code")
      return
    }

    if (!userLocation) {
      setError("Location services are required to submit attendance")
      return
    }

    setSubmitting(true)
    setError("")

    try {
      // Get the selected course data
      const course = activeCourses.find((c) => c.id === selectedCourse)

      if (!course) {
        throw new Error("Course not found")
      }

      // Verify location if room has location data
      if (course.roomLocation) {
        const distance = calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          course.roomLocation.latitude,
          course.roomLocation.longitude,
        )

        // If user is more than 100 meters away from the classroom
        if (distance > 100) {
          throw new Error("You appear to be too far from the classroom. Please ensure you are physically present.")
        }
      }

      // Verify attendance code if using code method
      if (!showScanner) {
        // Get the attendance session
        const sessionRef = doc(db, "attendance_sessions", course.sessionId)
        const sessionSnapshot = await getDoc(sessionRef)

        if (!sessionSnapshot.exists()) {
          throw new Error("Attendance session not found")
        }

        const sessionData = sessionSnapshot.data()

        if (attendanceCode !== sessionData.code) {
          throw new Error("Invalid attendance code. Please try again.")
        }
      }

      // Get current user
      const user = auth.currentUser

      if (!user) {
        throw new Error("User not authenticated")
      }

      // Get student data
      const studentRef = collection(db, "students")
      const studentQuery = query(studentRef, where("user_id", "==", user.uid))
      const studentSnapshot = await getDocs(studentQuery)

      if (studentSnapshot.empty) {
        throw new Error("Student record not found")
      }

      const studentId = studentSnapshot.docs[0].id

      // Record attendance
      await addDoc(collection(db, "attendance"), {
        timetable_id: selectedCourse,
        student_id: studentId,
        timestamp: new Date(),
        status: "present",
        location: userLocation,
      })

      setSuccess(true)
      setAttendanceCode("")
      setSelectedCourse("")
    } catch (error) {
      console.error("Error submitting attendance:", error)
      setError(error.message)
    } finally {
      setSubmitting(false)
    }
  }

  // Calculate distance between two points using Haversine formula
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3 // Earth radius in meters
    const φ1 = (lat1 * Math.PI) / 180
    const φ2 = (lat2 * Math.PI) / 180
    const Δφ = ((lat2 - lat1) * Math.PI) / 180
    const Δλ = ((lon2 - lon1) * Math.PI) / 180

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    return R * c // Distance in meters
  }

  // Reset success state after 3 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess(false)
      }, 3000)

      return () => clearTimeout(timer)
    }
  }, [success])

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

            <h1 className="text-xl font-bold">Submit Attendance</h1>
          </div>
        </header>

        {/* Submit Attendance Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-md mx-auto space-y-6">
            {success && (
              <Alert className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                <AlertTitle>Success!</AlertTitle>
                <AlertDescription>Your attendance has been recorded successfully.</AlertDescription>
              </Alert>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Mark Your Attendance</CardTitle>
                <CardDescription>Submit your attendance for today's class</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="course">Select Course</Label>
                  <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                    <SelectTrigger id="course">
                      <SelectValue placeholder="Select Course" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeCourses.map((course) => (
                        <SelectItem key={course.id} value={course.id}>
                          {course.name} ({course.time.split(" - ")[0]})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {activeCourses.length === 0 && (
                    <p className="text-sm text-amber-600 mt-2">
                      No active attendance sessions found. Please check with your lecturer.
                    </p>
                  )}
                </div>

                {selectedCourse && (
                  <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-800/50">
                    <div className="text-center mb-4">
                      <h3 className="font-medium">{activeCourses.find((c) => c.id === selectedCourse)?.name}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {activeCourses.find((c) => c.id === selectedCourse)?.time}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {activeCourses.find((c) => c.id === selectedCourse)?.room} |
                        {activeCourses.find((c) => c.id === selectedCourse)?.lecturer}
                      </p>
                    </div>

                    {!showScanner ? (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="code">Attendance Code</Label>
                          <Input
                            id="code"
                            placeholder="Enter the 6-digit code"
                            value={attendanceCode}
                            onChange={(e) => setAttendanceCode(e.target.value)}
                          />
                        </div>

                        <div className="text-center">
                          <p className="text-sm text-gray-500 mb-2">- OR -</p>
                          <Button variant="outline" className="w-full" onClick={() => setShowScanner(true)}>
                            <QrCode className="h-4 w-4 mr-2" />
                            Scan QR Code
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex justify-center">
                          <div className="bg-white p-4 rounded-lg border">
                            <div className="w-48 h-48 bg-gray-200 flex items-center justify-center">
                              <QrCode className="h-24 w-24 text-gray-400" />
                            </div>
                          </div>
                        </div>

                        <p className="text-sm text-center text-gray-500">
                          Point your camera at the QR code displayed by your lecturer
                        </p>

                        <Button variant="outline" className="w-full" onClick={() => setShowScanner(false)}>
                          Enter Code Instead
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  onClick={submitAttendance}
                  disabled={submitting || !selectedCourse || (!attendanceCode && !showScanner)}
                >
                  {submitting ? "Submitting..." : "Submit Attendance"}
                </Button>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Location Verification</CardTitle>
                <CardDescription>Your attendance will be verified based on your location</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-sm text-gray-500">
                    To ensure you are physically present in the class, the system will verify your location when you
                    submit attendance.
                  </p>

                  <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
                    <p className="text-sm text-yellow-800 dark:text-yellow-400">
                      {userLocation
                        ? "Location services are enabled. You're ready to submit attendance."
                        : "Please enable location services to submit attendance."}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  )
}

