"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Calendar, Clock, BookOpen, Users, Settings, LogOut, Bell, CheckSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { getAuth, signOut } from "firebase/auth"
import { getFirestore, collection, getDocs, query, where } from "firebase/firestore"
import { app } from "../firebaseConfig"

export default function Dashboard() {
  const router = useRouter()
  const auth = getAuth(app)
  const db = getFirestore(app)

  const [userRole, setUserRole] = useState("")
  const [userName, setUserName] = useState("")
  const [userProgram, setUserProgram] = useState("")
  const [upcomingClasses, setUpcomingClasses] = useState([])
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check if user is authenticated
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        try {
          // Get user data from Firestore
          const userRef = collection(db, "users")
          const q = query(userRef, where("email", "==", user.email))
          const querySnapshot = await getDocs(q)

          if (!querySnapshot.empty) {
            const userData = querySnapshot.docs[0].data()
            setUserName(userData.name || user.displayName || "User")
            setUserRole(userData.role || "student")

            if (userData.role === "student") {
              // Get student program
              const studentRef = collection(db, "students")
              const studentQuery = query(studentRef, where("user_id", "==", user.uid))
              const studentSnapshot = await getDocs(studentQuery)

              if (!studentSnapshot.empty) {
                const studentData = studentSnapshot.docs[0].data()

                // Get program name
                const programRef = collection(db, "programs")
                const programQuery = query(programRef, where("id", "==", studentData.program_id))
                const programSnapshot = await getDocs(programQuery)

                if (!programSnapshot.empty) {
                  setUserProgram(programSnapshot.docs[0].data().name)
                }
              }
            }

            // Get upcoming classes based on user role
            await fetchUpcomingClasses(user.uid, userData.role)

            // Get notifications
            await fetchNotifications(user.uid)
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

  const fetchUpcomingClasses = async (userId, role) => {
    try {
      const today = new Date()
      const dayOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][today.getDay()]

      // Get timetable entries for today
      const timetableRef = collection(db, "timetable")
      let timetableQuery

      if (role === "student") {
        // Get student's program
        const studentRef = collection(db, "students")
        const studentQuery = query(studentRef, where("user_id", "==", userId))
        const studentSnapshot = await getDocs(studentQuery)

        if (!studentSnapshot.empty) {
          const programId = studentSnapshot.docs[0].data().program_id
          timetableQuery = query(timetableRef, where("program_id", "==", programId), where("day", "==", dayOfWeek))
        }
      } else if (role === "lecturer") {
        // Get lecturer's ID
        const lecturerRef = collection(db, "lecturers")
        const lecturerQuery = query(lecturerRef, where("user_id", "==", userId))
        const lecturerSnapshot = await getDocs(lecturerQuery)

        if (!lecturerSnapshot.empty) {
          const lecturerId = lecturerSnapshot.docs[0].id
          timetableQuery = query(timetableRef, where("lecturer_id", "==", lecturerId), where("day", "==", dayOfWeek))
        }
      } else {
        // Admin sees all classes for today
        timetableQuery = query(timetableRef, where("day", "==", dayOfWeek))
      }

      if (timetableQuery) {
        const timetableSnapshot = await getDocs(timetableQuery)
        const classes = []

        for (const doc of timetableSnapshot.docs) {
          const timetableData = doc.data()

          // Get course details
          const courseRef = collection(db, "courses")
          const courseQuery = query(courseRef, where("id", "==", timetableData.course_id))
          const courseSnapshot = await getDocs(courseQuery)

          // Get room details
          const roomRef = collection(db, "rooms")
          const roomQuery = query(roomRef, where("id", "==", timetableData.room_id))
          const roomSnapshot = await getDocs(roomQuery)

          // Get lecturer details
          const lecturerRef = collection(db, "lecturers")
          const lecturerQuery = query(lecturerRef, where("id", "==", timetableData.lecturer_id))
          const lecturerSnapshot = await getDocs(lecturerQuery)

          if (!courseSnapshot.empty && !roomSnapshot.empty && !lecturerSnapshot.empty) {
            const courseData = courseSnapshot.docs[0].data()
            const roomData = roomSnapshot.docs[0].data()

            // Get lecturer's user data
            const lecturerData = lecturerSnapshot.docs[0].data()
            const userRef = collection(db, "users")
            const userQuery = query(userRef, where("id", "==", lecturerData.user_id))
            const userSnapshot = await getDocs(userQuery)

            let lecturerName = "Unknown"
            if (!userSnapshot.empty) {
              lecturerName = userSnapshot.docs[0].data().name
            }

            classes.push({
              id: doc.id,
              course: courseData.name,
              room: roomData.name,
              time: `${timetableData.start_time} - ${timetableData.end_time}`,
              lecturer: lecturerName,
            })
          }
        }

        setUpcomingClasses(classes)
      }
    } catch (error) {
      console.error("Error fetching upcoming classes:", error)
    }
  }

  const fetchNotifications = async (userId) => {
    try {
      // This would be replaced with actual notification fetching logic
      setNotifications([
        { id: 1, message: "Timetable updated for next week", time: "2 hours ago" },
        { id: 2, message: "New course material available", time: "1 day ago" },
        { id: 3, message: "Attendance recorded for Operating Systems", time: "2 days ago" },
      ])
    } catch (error) {
      console.error("Error fetching notifications:", error)
    }
  }

  const handleLogout = async () => {
    try {
      await signOut(auth)
      router.push("/login")
    } catch (error) {
      console.error("Error signing out:", error)
    }
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
      {/* Sidebar */}
      <div className="hidden md:flex flex-col w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
        <div className="p-6">
          <h2 className="text-2xl font-bold text-primary">UniScheduler</h2>
        </div>

        <div className="flex-1 px-4 space-y-2">
          <Button variant="ghost" className="w-full justify-start" onClick={() => router.push("/dashboard")}>
            <Calendar className="mr-2 h-5 w-5" />
            Dashboard
          </Button>

          <Button variant="ghost" className="w-full justify-start" onClick={() => router.push("/timetable")}>
            <Clock className="mr-2 h-5 w-5" />
            Timetable
          </Button>

          {userRole === "student" && (
            <Button variant="ghost" className="w-full justify-start" onClick={() => router.push("/courses")}>
              <BookOpen className="mr-2 h-5 w-5" />
              My Courses
            </Button>
          )}

          {userRole === "lecturer" && (
            <>
              <Button variant="ghost" className="w-full justify-start" onClick={() => router.push("/courses")}>
                <BookOpen className="mr-2 h-5 w-5" />
                My Courses
              </Button>
              <Button variant="ghost" className="w-full justify-start" onClick={() => router.push("/attendance")}>
                <CheckSquare className="mr-2 h-5 w-5" />
                Attendance
              </Button>
            </>
          )}

          {userRole === "admin" && (
            <>
              <Button variant="ghost" className="w-full justify-start" onClick={() => router.push("/programs")}>
                <BookOpen className="mr-2 h-5 w-5" />
                Programs
              </Button>
              <Button variant="ghost" className="w-full justify-start" onClick={() => router.push("/users")}>
                <Users className="mr-2 h-5 w-5" />
                Users
              </Button>
              <Button variant="ghost" className="w-full justify-start" onClick={() => router.push("/generator")}>
                <Settings className="mr-2 h-5 w-5" />
                Generate Timetable
              </Button>
            </>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <Button
            variant="ghost"
            className="w-full justify-start text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
            onClick={handleLogout}
          >
            <LogOut className="mr-2 h-5 w-5" />
            Logout
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Navigation */}
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div className="md:hidden">
              <h2 className="text-xl font-bold text-primary">UniScheduler</h2>
            </div>

            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5" />
                <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-red-500"></span>
              </Button>

              <div className="flex items-center space-x-2">
                <Avatar>
                  <AvatarImage src="/placeholder.svg?height=40&width=40" alt={userName} />
                  <AvatarFallback>
                    {userName
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </AvatarFallback>
                </Avatar>

                <div className="hidden md:block">
                  <p className="text-sm font-medium">{userName}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {userRole.charAt(0).toUpperCase() + userRole.slice(1)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">Welcome, {userName}</h1>
            <p className="text-gray-500 dark:text-gray-400">
              {userRole === "student"
                ? `Program: ${userProgram}`
                : userRole === "lecturer"
                  ? "Your teaching schedule"
                  : "University Timetable Administration"}
            </p>
          </div>

          <Tabs defaultValue="overview">
            <TabsList className="mb-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="notifications">Notifications</TabsTrigger>
              {userRole === "admin" && <TabsTrigger value="stats">Statistics</TabsTrigger>}
            </TabsList>

            <TabsContent value="overview">
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle>Today's Schedule</CardTitle>
                    <CardDescription>Your classes for today</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {upcomingClasses.length > 0 ? (
                      <div className="space-y-4">
                        {upcomingClasses.map((cls) => (
                          <div key={cls.id} className="border-b pb-3 last:border-0 last:pb-0">
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="font-medium">{cls.course}</h4>
                                <p className="text-sm text-gray-500 dark:text-gray-400">{cls.room}</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">{cls.time}</p>
                              </div>
                              {userRole === "student" && <Badge variant="outline">{cls.lecturer}</Badge>}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 dark:text-gray-400">No classes scheduled for today.</p>
                    )}
                  </CardContent>
                  <CardFooter>
                    <Button variant="outline" className="w-full" onClick={() => router.push("/timetable")}>
                      View Full Timetable
                    </Button>
                  </CardFooter>
                </Card>

                {userRole === "lecturer" && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle>Attendance</CardTitle>
                      <CardDescription>Manage class attendance</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {upcomingClasses.map((cls) => (
                          <div key={cls.id} className="border-b pb-3 last:border-0 last:pb-0">
                            <div className="flex justify-between items-center">
                              <div>
                                <h4 className="font-medium">{cls.course}</h4>
                                <p className="text-sm text-gray-500 dark:text-gray-400">{cls.time}</p>
                              </div>
                              <Button size="sm" onClick={() => router.push(`/attendance/${cls.id}`)}>
                                Take Attendance
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {userRole === "student" && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle>Attendance Status</CardTitle>
                      <CardDescription>Your attendance records</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {upcomingClasses.map((cls) => (
                          <div key={cls.id} className="border-b pb-3 last:border-0 last:pb-0">
                            <div className="flex justify-between items-center">
                              <div>
                                <h4 className="font-medium">{cls.course}</h4>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Last week: 2/2 classes</p>
                              </div>
                              <Badge>90%</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                    <CardFooter>
                      <Button variant="outline" className="w-full" onClick={() => router.push("/attendance/history")}>
                        View Full History
                      </Button>
                    </CardFooter>
                  </Card>
                )}

                {userRole === "admin" && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle>Timetable Status</CardTitle>
                      <CardDescription>Current scheduling status</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <p>Computer Science</p>
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            Generated
                          </Badge>
                        </div>
                        <div className="flex justify-between items-center">
                          <p>Information Technology</p>
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            Generated
                          </Badge>
                        </div>
                        <div className="flex justify-between items-center">
                          <p>Business Administration</p>
                          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                            Pending
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter>
                      <Button className="w-full" onClick={() => router.push("/generator")}>
                        Generate Timetables
                      </Button>
                    </CardFooter>
                  </Card>
                )}

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle>Quick Actions</CardTitle>
                    <CardDescription>Frequently used features</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-2">
                      {userRole === "student" && (
                        <>
                          <Button
                            variant="outline"
                            className="h-20 flex flex-col items-center justify-center"
                            onClick={() => router.push("/timetable")}
                          >
                            <Calendar className="h-6 w-6 mb-1" />
                            <span>View Timetable</span>
                          </Button>
                          <Button
                            variant="outline"
                            className="h-20 flex flex-col items-center justify-center"
                            onClick={() => router.push("/attendance/submit")}
                          >
                            <CheckSquare className="h-6 w-6 mb-1" />
                            <span>Submit Attendance</span>
                          </Button>
                        </>
                      )}

                      {userRole === "lecturer" && (
                        <>
                          <Button
                            variant="outline"
                            className="h-20 flex flex-col items-center justify-center"
                            onClick={() => router.push("/timetable")}
                          >
                            <Calendar className="h-6 w-6 mb-1" />
                            <span>View Timetable</span>
                          </Button>
                          <Button
                            variant="outline"
                            className="h-20 flex flex-col items-center justify-center"
                            onClick={() => router.push("/attendance")}
                          >
                            <CheckSquare className="h-6 w-6 mb-1" />
                            <span>Take Attendance</span>
                          </Button>
                          <Button
                            variant="outline"
                            className="h-20 flex flex-col items-center justify-center"
                            onClick={() => router.push("/preferences")}
                          >
                            <Settings className="h-6 w-6 mb-1" />
                            <span>Time Preferences</span>
                          </Button>
                        </>
                      )}

                      {userRole === "admin" && (
                        <>
                          <Button
                            variant="outline"
                            className="h-20 flex flex-col items-center justify-center"
                            onClick={() => router.push("/generator")}
                          >
                            <Settings className="h-6 w-6 mb-1" />
                            <span>Generate</span>
                          </Button>
                          <Button
                            variant="outline"
                            className="h-20 flex flex-col items-center justify-center"
                            onClick={() => router.push("/timetable/edit")}
                          >
                            <Calendar className="h-6 w-6 mb-1" />
                            <span>Edit Timetable</span>
                          </Button>
                          <Button
                            variant="outline"
                            className="h-20 flex flex-col items-center justify-center"
                            onClick={() => router.push("/users")}
                          >
                            <Users className="h-6 w-6 mb-1" />
                            <span>Manage Users</span>
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="notifications">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Notifications</CardTitle>
                  <CardDescription>Stay updated with the latest changes</CardDescription>
                </CardHeader>
                <CardContent>
                  {notifications.length > 0 ? (
                    <div className="space-y-4">
                      {notifications.map((notification) => (
                        <div key={notification.id} className="flex items-start space-x-4 border-b pb-4 last:border-0">
                          <div className="rounded-full bg-primary/10 p-2">
                            <Bell className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium">{notification.message}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{notification.time}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 dark:text-gray-400">No new notifications.</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {userRole === "admin" && (
              <TabsContent value="stats">
                <Card>
                  <CardHeader>
                    <CardTitle>System Statistics</CardTitle>
                    <CardDescription>Overview of the scheduling system</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      <div className="bg-primary/10 rounded-lg p-4">
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Programs</p>
                        <p className="text-3xl font-bold">12</p>
                      </div>
                      <div className="bg-primary/10 rounded-lg p-4">
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Courses</p>
                        <p className="text-3xl font-bold">156</p>
                      </div>
                      <div className="bg-primary/10 rounded-lg p-4">
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Lecturers</p>
                        <p className="text-3xl font-bold">48</p>
                      </div>
                      <div className="bg-primary/10 rounded-lg p-4">
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Students</p>
                        <p className="text-3xl font-bold">1,245</p>
                      </div>
                      <div className="bg-primary/10 rounded-lg p-4">
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Available Rooms</p>
                        <p className="text-3xl font-bold">32</p>
                      </div>
                      <div className="bg-primary/10 rounded-lg p-4">
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Scheduling Conflicts</p>
                        <p className="text-3xl font-bold">0</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            )}
          </Tabs>
        </main>
      </div>
    </div>
  )
}

