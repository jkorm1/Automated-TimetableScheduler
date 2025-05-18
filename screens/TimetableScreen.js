"use client"

import { useState, useEffect } from "react"
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Alert,
} from "react-native"
import { Card } from "react-native-paper"
import { Ionicons } from "@expo/vector-icons"
import { createNativeStackNavigator } from "@react-navigation/native-stack"
import { Picker } from "@react-native-picker/picker"
import { auth, db } from "../firebaseConfig"
import { collection, getDocs, query, where, doc, getDoc } from "firebase/firestore"

// KNUST color theme
const COLORS = {
  primary: "#006400", // Dark green
  secondary: "#FFD700", // Gold/Yellow
  background: "#F5F5F5",
  cardBackground: "#FFFFFF",
  text: "#333333",
  textLight: "#666666",
  accent: "#008000", // Medium green
  border: "#E0E0E0",
  success: "#4CAF50",
  warning: "#FFC107",
  error: "#F44336",
  info: "#2196F3",
}

const Stack = createNativeStackNavigator()

const TimetableScreen = ({ route }) => {
  const { userRole, refresh } = route.params || { userRole: "student", refresh: false }

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: COLORS.primary,
        },
        headerTintColor: COLORS.secondary,
        headerTitleStyle: {
          fontWeight: "bold",
        },
      }}
    >
      <Stack.Screen
        name="ViewTimetable"
        component={ViewTimetableScreen}
        options={{ headerShown: false }}
        initialParams={{ userRole, refresh }}
      />
      {userRole === "admin" && (
        <Stack.Screen
          name="Edit"
          component={EditTimetableScreen}
          options={{
            title: "Edit Timetable",
            headerStyle: {
              backgroundColor: COLORS.primary,
            },
            headerTintColor: COLORS.secondary,
          }}
        />
      )}
    </Stack.Navigator>
  )
}

const ViewTimetableScreen = ({ route, navigation }) => {
  const { userRole, refresh } = route.params || { userRole: "student", refresh: false }
  const [selectedProgram, setSelectedProgram] = useState("")
  const [selectedView, setSelectedView] = useState("week") // 'week' or 'day'
  const [programs, setPrograms] = useState([])
  const [timetableData, setTimetableData] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [debugMode, setDebugMode] = useState(false)
  const [debugInfo, setDebugInfo] = useState({
    lastAction: "",
    programId: "",
    entriesFound: 0,
    processedEntries: 0,
    errors: [],
  })

  // Days of the week
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
  const weekdays = days.slice(0, 5) // Monday to Friday

  // Time slots from 8am to 7pm
  const timeSlots = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"]

  // Format time for display (convert 24h to 12h format)
  const formatTimeForDisplay = (time) => {
    if (!time) return ""

    const [hours, minutes] = time.split(":")
    const hour = Number.parseInt(hours)

    if (hour < 12) {
      return `${hour === 0 ? 12 : hour}:${minutes || "00"} AM`
    } else {
      return `${hour === 12 ? 12 : hour - 12}:${minutes || "00"} PM`
    }
  }

  useEffect(() => {
    console.log("TimetableScreen mounted or refresh changed:", refresh)
    fetchTimetableData()
  }, [refresh])

  const fetchTimetableData = async () => {
    try {
      setLoading(true)
      setDebugInfo((prev) => ({ ...prev, lastAction: "fetchTimetableData started" }))

      const user = auth.currentUser
      if (!user) {
        console.log("No user logged in")
        setDebugInfo((prev) => ({ ...prev, lastAction: "No user logged in" }))
        setLoading(false)
        return
      }

      console.log("Fetching timetable data for user:", user.uid, "with role:", userRole)
      setDebugInfo((prev) => ({
        ...prev,
        lastAction: `Fetching for user ${user.uid} with role ${userRole}`,
      }))

      // Fetch programs
      await fetchPrograms()

      // Fetch timetable based on user role
      if (userRole === "student") {
        // Get student's program
        const studentRef = collection(db, "students")
        const studentQuery = query(studentRef, where("user_id", "==", user.uid))
        const studentSnapshot = await getDocs(studentQuery)

        if (!studentSnapshot.empty) {
          const studentData = studentSnapshot.docs[0].data()
          console.log("Student program:", studentData.program_id)
          setSelectedProgram(studentData.program_id)
          setDebugInfo((prev) => ({
            ...prev,
            lastAction: `Student program found: ${studentData.program_id}`,
            programId: studentData.program_id,
          }))
          await fetchTimetable(studentData.program_id)
        } else {
          console.log("No student data found")
          setDebugInfo((prev) => ({ ...prev, lastAction: "No student data found" }))
        }
      } else if (userRole === "lecturer") {
        // For lecturers, we'll show their teaching schedule across programs
        await fetchLecturerTimetable(user.uid)
      } else {
        // For admins, show the first program by default
        if (programs.length > 0) {
          console.log("Admin viewing program:", programs[0].id)
          setSelectedProgram(programs[0].id)
          setDebugInfo((prev) => ({
            ...prev,
            lastAction: `Admin viewing program: ${programs[0].id}`,
            programId: programs[0].id,
          }))
          await fetchTimetable(programs[0].id)
        } else {
          console.log("No programs found")
          setDebugInfo((prev) => ({ ...prev, lastAction: "No programs found" }))
        }
      }
    } catch (error) {
      console.error("Error fetching timetable data:", error)
      setDebugInfo((prev) => ({
        ...prev,
        lastAction: "Error in fetchTimetableData",
        errors: [...prev.errors, error.message || "Unknown error"],
      }))
      Alert.alert("Error", "Failed to load timetable data. Please try again.")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // Fetch programs from Firestore
  const fetchPrograms = async () => {
    try {
      setDebugInfo((prev) => ({ ...prev, lastAction: "fetchPrograms started" }))
      const programsRef = collection(db, "programs")
      const programsSnapshot = await getDocs(programsRef)

      const programsData = []
      programsSnapshot.forEach((doc) => {
        programsData.push({
          id: doc.id,
          ...doc.data(),
        })
      })

      console.log(`Fetched ${programsData.length} programs`)
      setDebugInfo((prev) => ({
        ...prev,
        lastAction: `Fetched ${programsData.length} programs`,
      }))
      setPrograms(programsData)
    } catch (error) {
      console.error("Error fetching programs:", error)
      setDebugInfo((prev) => ({
        ...prev,
        lastAction: "Error in fetchPrograms",
        errors: [...prev.errors, error.message || "Unknown error"],
      }))
    }
  }

  // Fetch timetable for a specific program
  const fetchTimetable = async (programId) => {
    try {
      console.log("Fetching timetable for program:", programId)
      setDebugInfo((prev) => ({
        ...prev,
        lastAction: `fetchTimetable started for program: ${programId}`,
        programId: programId,
      }))

      // IMPORTANT: Check if programId is valid
      if (!programId) {
        console.error("Invalid program ID:", programId)
        setDebugInfo((prev) => ({
          ...prev,
          lastAction: "Invalid program ID",
          errors: [...prev.errors, "Invalid program ID"],
        }))
        setTimetableData([])
        return
      }

      const timetableRef = collection(db, "timetable")
      const q = query(timetableRef, where("program_id", "==", programId))
      const timetableSnapshot = await getDocs(q)

      console.log(`Found ${timetableSnapshot.docs.length} timetable entries`)
      setDebugInfo((prev) => ({
        ...prev,
        lastAction: `Found ${timetableSnapshot.docs.length} timetable entries`,
        entriesFound: timetableSnapshot.docs.length,
      }))

      if (timetableSnapshot.empty) {
        console.log("No timetable entries found for this program")
        setTimetableData([])
        return
      }

      const timetableEntries = []
      const courseCache = {}
      const roomCache = {}
      const lecturerCache = {}
      const userCache = {}
      let processedCount = 0
      let errorCount = 0

      for (const doc of timetableSnapshot.docs) {
        try {
          const timetableData = doc.data()
          console.log("Processing timetable entry:", doc.id, timetableData)

          // Debug: Log the raw timetable data
          console.log("Raw timetable data:", JSON.stringify(timetableData))

          // IMPORTANT: Validate required fields
          if (!timetableData.course_id || !timetableData.room_id || !timetableData.lecturer_id) {
            console.error("Missing required fields in timetable entry:", doc.id)
            setDebugInfo((prev) => ({
              ...prev,
              errors: [...prev.errors, `Missing required fields in entry ${doc.id}`],
            }))
            errorCount++
            continue
          }

          // Get course details (with caching)
          let courseData
          if (courseCache[timetableData.course_id]) {
            courseData = courseCache[timetableData.course_id]
          } else {
            const courseRef = collection(db, "courses")
            const courseQuery = query(courseRef, where("id", "==", timetableData.course_id))
            const courseSnapshot = await getDocs(courseQuery)

            if (!courseSnapshot.empty) {
              courseData = courseSnapshot.docs[0].data()
              courseCache[timetableData.course_id] = courseData
            } else {
              // Instead of skipping this entry, create a placeholder course
              console.log(`Course not found: ${timetableData.course_id}, using placeholder data`)
              courseData = {
                name: `Course ${timetableData.course_id.substring(0, 5)}`,
                code: "Unknown",
                year: 1,
                semester: 1,
                enrolled_students: 0,
                expected_students: 0,
              }
              courseCache[timetableData.course_id] = courseData
              setDebugInfo((prev) => ({
                ...prev,
                errors: [...prev.errors, `Course not found: ${timetableData.course_id}, using placeholder`],
              }))
            }
          }

          // Get room details (with caching)
          let roomData
          if (roomCache[timetableData.room_id]) {
            roomData = roomCache[timetableData.room_id]
          } else {
            const roomRef = collection(db, "rooms")
            const roomQuery = query(roomRef, where("id", "==", timetableData.room_id))
            const roomSnapshot = await getDocs(roomQuery)

            if (!roomSnapshot.empty) {
              roomData = roomSnapshot.docs[0].data()
              roomCache[timetableData.room_id] = roomData
            } else {
              // Instead of skipping this entry, create a placeholder room
              console.log(`Room not found: ${timetableData.room_id}, using placeholder data`)
              roomData = {
                name: `Room ${timetableData.room_id.substring(0, 5)}`,
                capacity: 30,
              }
              roomCache[timetableData.room_id] = roomData
              setDebugInfo((prev) => ({
                ...prev,
                errors: [...prev.errors, `Room not found: ${timetableData.room_id}, using placeholder`],
              }))
            }
          }

          // Get lecturer details (with caching)
          let lecturerData
          if (lecturerCache[timetableData.lecturer_id]) {
            lecturerData = lecturerCache[timetableData.lecturer_id]
          } else {
            const lecturerRef = collection(db, "lecturers")
            const lecturerQuery = query(lecturerRef, where("id", "==", timetableData.lecturer_id))
            const lecturerSnapshot = await getDocs(lecturerQuery)

            if (!lecturerSnapshot.empty) {
              lecturerData = lecturerSnapshot.docs[0].data()
              lecturerCache[timetableData.lecturer_id] = lecturerData
            } else {
              // Instead of skipping this entry, create a placeholder lecturer
              console.log(`Lecturer not found: ${timetableData.lecturer_id}, using placeholder data`)
              lecturerData = {
                name: "Unknown Lecturer",
                user_id: null,
              }
              lecturerCache[timetableData.lecturer_id] = lecturerData
              setDebugInfo((prev) => ({
                ...prev,
                errors: [...prev.errors, `Lecturer not found: ${timetableData.lecturer_id}, using placeholder`],
              }))
            }
          }

          // Get lecturer's user data (with caching)
          let lecturerName = "Unknown"
          if (lecturerData.user_id) {
            if (userCache[lecturerData.user_id]) {
              lecturerName = userCache[lecturerData.user_id].name || "Unknown"
            } else {
              const userRef = collection(db, "users")
              const userQuery = query(userRef, where("id", "==", lecturerData.user_id))
              const userSnapshot = await getDocs(userQuery)

              if (!userSnapshot.empty) {
                const userData = userSnapshot.docs[0].data()
                userCache[lecturerData.user_id] = userData
                lecturerName = userData.name || "Unknown"
              }
            }
          }

          // Assign a color based on course
          const colors = [
            "#e6ffe6", // light green (KNUST theme)
            "#fff7e6", // light yellow (KNUST theme)
            "#e6f7ff", // light blue
            "#f7e6ff", // light purple
            "#ffe6e6", // light red
            "#e6f2ff", // light indigo
          ]

          const colorIndex = timetableEntries.length % colors.length

          // Create timetable entry with all required fields
          timetableEntries.push({
            id: doc.id,
            day: timetableData.day,
            startTime: timetableData.start_time,
            endTime: timetableData.end_time,
            course: courseData.name || "Unknown Course",
            courseCode: courseData.code || "",
            room: roomData.name || "Unknown Room",
            capacity: roomData.capacity || 0,
            students: courseData.enrolled_students || courseData.expected_students || 0,
            lecturer: lecturerName,
            program: programs.find((p) => p.id === programId)?.name || "Unknown Program",
            year: courseData.year || 1,
            semester: courseData.semester || 1,
            color: colors[colorIndex],
          })

          processedCount++
        } catch (error) {
          console.error("Error processing timetable entry:", error)
          setDebugInfo((prev) => ({
            ...prev,
            errors: [...prev.errors, `Error processing entry: ${error.message || "Unknown error"}`],
          }))
          errorCount++
        }
      }

      console.log(`Processed ${timetableEntries.length} valid timetable entries with ${errorCount} errors`)
      setDebugInfo((prev) => ({
        ...prev,
        lastAction: `Processed ${timetableEntries.length} entries with ${errorCount} errors`,
        processedEntries: processedCount,
      }))

      // IMPORTANT: Set the timetable data even if it's empty
      setTimetableData(timetableEntries)
    } catch (error) {
      console.error("Error fetching timetable:", error)
      setDebugInfo((prev) => ({
        ...prev,
        lastAction: "Error in fetchTimetable",
        errors: [...prev.errors, error.message || "Unknown error"],
      }))
      Alert.alert("Error", "Failed to load timetable. Please try again.")
      setTimetableData([]) // Ensure we clear the data on error
    }
  }

  // Fetch timetable for a specific lecturer
  const fetchLecturerTimetable = async (userId) => {
    try {
      console.log("Fetching timetable for lecturer with user ID:", userId)
      setDebugInfo((prev) => ({
        ...prev,
        lastAction: `fetchLecturerTimetable started for user: ${userId}`,
      }))

      // Get lecturer ID
      const lecturerRef = collection(db, "lecturers")
      const lecturerQuery = query(lecturerRef, where("user_id", "==", userId))
      const lecturerSnapshot = await getDocs(lecturerQuery)

      if (!lecturerSnapshot.empty) {
        const lecturerId = lecturerSnapshot.docs[0].id
        console.log("Found lecturer ID:", lecturerId)
        setDebugInfo((prev) => ({
          ...prev,
          lastAction: `Found lecturer ID: ${lecturerId}`,
        }))

        // Get timetable entries for this lecturer
        const timetableRef = collection(db, "timetable")
        const timetableQuery = query(timetableRef, where("lecturer_id", "==", lecturerId))
        const timetableSnapshot = await getDocs(timetableQuery)

        console.log(`Found ${timetableSnapshot.docs.length} timetable entries for lecturer`)
        setDebugInfo((prev) => ({
          ...prev,
          lastAction: `Found ${timetableSnapshot.docs.length} entries for lecturer`,
          entriesFound: timetableSnapshot.docs.length,
        }))

        const timetableEntries = []
        const courseCache = {}
        const roomCache = {}
        const programCache = {}
        let processedCount = 0

        for (const doc of timetableSnapshot.docs) {
          try {
            const timetableData = doc.data()

            // Get course details (with caching)
            let courseData
            if (courseCache[timetableData.course_id]) {
              courseData = courseCache[timetableData.course_id]
            } else {
              const courseRef = collection(db, "courses")
              const courseQuery = query(courseRef, where("id", "==", timetableData.course_id))
              const courseSnapshot = await getDocs(courseQuery)

              if (!courseSnapshot.empty) {
                courseData = courseSnapshot.docs[0].data()
                courseCache[timetableData.course_id] = courseData
              } else {
                console.log(`Course not found: ${timetableData.course_id}`)
                continue
              }
            }

            // Get room details (with caching)
            let roomData
            if (roomCache[timetableData.room_id]) {
              roomData = roomCache[timetableData.room_id]
            } else {
              const roomRef = collection(db, "rooms")
              const roomQuery = query(roomRef, where("id", "==", timetableData.room_id))
              const roomSnapshot = await getDocs(roomQuery)

              if (!roomSnapshot.empty) {
                roomData = roomSnapshot.docs[0].data()
                roomCache[timetableData.room_id] = roomData
              } else {
                console.log(`Room not found: ${timetableData.room_id}`)
                continue
              }
            }

            // Get program details (with caching)
            let programData
            if (programCache[timetableData.program_id]) {
              programData = programCache[timetableData.program_id]
            } else {
              const programRef = collection(db, "programs")
              const programQuery = query(programRef, where("id", "==", timetableData.program_id))
              const programSnapshot = await getDocs(programQuery)

              if (!programSnapshot.empty) {
                programData = programSnapshot.docs[0].data()
                programCache[timetableData.program_id] = programData
              } else {
                console.log(`Program not found: ${timetableData.program_id}`)
                continue
              }
            }

            // Assign a color based on course
            const colors = [
              "#e6ffe6", // light green (KNUST theme)
              "#fff7e6", // light yellow (KNUST theme)
              "#e6f7ff", // light blue
              "#f7e6ff", // light purple
              "#ffe6e6", // light red
              "#e6f2ff", // light indigo
            ]

            const colorIndex = timetableEntries.length % colors.length

            timetableEntries.push({
              id: doc.id,
              day: timetableData.day,
              startTime: timetableData.start_time,
              endTime: timetableData.end_time,
              course: courseData.name || "Unknown Course",
              courseCode: courseData.code || "",
              room: roomData.name || "Unknown Room",
              capacity: roomData.capacity || 0,
              students: courseData.enrolled_students || courseData.expected_students || 0,
              lecturer: "You",
              program: programData.name || "Unknown Program",
              year: courseData.year || 1,
              semester: courseData.semester || 1,
              color: colors[colorIndex],
            })

            processedCount++
          } catch (error) {
            console.error("Error processing lecturer timetable entry:", error)
            setDebugInfo((prev) => ({
              ...prev,
              errors: [...prev.errors, `Error processing lecturer entry: ${error.message || "Unknown error"}`],
            }))
          }
        }

        console.log(`Processed ${timetableEntries.length} valid lecturer timetable entries`)
        setDebugInfo((prev) => ({
          ...prev,
          lastAction: `Processed ${timetableEntries.length} lecturer entries`,
          processedEntries: processedCount,
        }))
        setTimetableData(timetableEntries)
      } else {
        console.log("No lecturer found with user ID:", userId)
        setDebugInfo((prev) => ({
          ...prev,
          lastAction: `No lecturer found with user ID: ${userId}`,
          errors: [...prev.errors, `No lecturer found with user ID: ${userId}`],
        }))
      }
    } catch (error) {
      console.error("Error fetching lecturer timetable:", error)
      setDebugInfo((prev) => ({
        ...prev,
        lastAction: "Error in fetchLecturerTimetable",
        errors: [...prev.errors, error.message || "Unknown error"],
      }))
      Alert.alert("Error", "Failed to load your teaching schedule. Please try again.")
    }
  }

  // Handle program change
  const handleProgramChange = async (programId) => {
    console.log("Program changed to:", programId)
    setDebugInfo((prev) => ({
      ...prev,
      lastAction: `Program changed to: ${programId}`,
      programId: programId,
    }))
    setSelectedProgram(programId)
    await fetchTimetable(programId)
  }

  // Function to get classes for a specific day and time
  const getClassesForTimeSlot = (day, timeSlot) => {
    return timetableData.filter((cls) => cls.day === day && cls.startTime === timeSlot)
  }

  const onRefresh = () => {
    setRefreshing(true)
    fetchTimetableData()
  }

  // Debug component to show current state
  const DebugInfo = () => (
    <Card style={styles.debugCard}>
      <Card.Title title="Debug Information" />
      <Card.Content>
        <Text style={styles.debugText}>Last Action: {debugInfo.lastAction}</Text>
        <Text style={styles.debugText}>Program ID: {debugInfo.programId}</Text>
        <Text style={styles.debugText}>Entries Found: {debugInfo.entriesFound}</Text>
        <Text style={styles.debugText}>Processed Entries: {debugInfo.processedEntries}</Text>
        <Text style={styles.debugText}>Timetable Data Length: {timetableData.length}</Text>
        <Text style={styles.debugText}>Errors ({debugInfo.errors.length}):</Text>
        {debugInfo.errors.map((error, index) => (
          <Text key={index} style={styles.debugError}>
            - {error}
          </Text>
        ))}
      </Card.Content>
    </Card>
  )

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading timetable...</Text>
      </View>
    )
  }

  // Week View Component
  const WeekView = () => {
    // Determine which days to show (weekdays or all days)
    const displayDays = days
      .filter((day) => (day === "Saturday" || day === "Sunday" ? timetableData.some((cls) => cls.day === day) : true))
      .slice(0, 5) // Limit to first 5 days by default

    return (
      <ScrollView horizontal style={styles.weekViewContainer}>
        <View style={styles.weekViewContent}>
          {/* Header row with days */}
          <View style={styles.weekHeaderRow}>
            <View style={styles.timeHeaderCell}></View>
            {displayDays.map((day) => (
              <View key={day} style={styles.dayHeaderCell}>
                <Text style={styles.dayHeaderText}>{day}</Text>
              </View>
            ))}
          </View>

          {/* Time slots rows */}
          {timeSlots.map((timeSlot) => (
            <View key={timeSlot} style={styles.timeRow}>
              <View style={styles.timeCell}>
                <Text style={styles.timeText}>{formatTimeForDisplay(timeSlot)}</Text>
              </View>

              {displayDays.map((day) => {
                const classes = getClassesForTimeSlot(day, timeSlot)
                return (
                  <View key={`${day}-${timeSlot}`} style={styles.dayCell}>
                    {classes.map((cls) => (
                      <TouchableOpacity
                        key={cls.id}
                        style={[styles.classCard, { backgroundColor: cls.color }]}
                        onPress={() => {
                          if (userRole === "admin") {
                            navigation.navigate("Edit", { classId: cls.id })
                          }
                        }}
                      >
                        <Text style={styles.classTitle} numberOfLines={1}>
                          {cls.course}
                        </Text>
                        <Text style={styles.classInfo} numberOfLines={1}>
                          {cls.room}
                        </Text>
                        <Text style={styles.classInfo} numberOfLines={1}>
                          {cls.lecturer}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )
              })}
            </View>
          ))}
        </View>
      </ScrollView>
    )
  }

  // Day View Component
  const DayView = () => {
    // Only show days that have classes
    const daysWithClasses = days.filter((day) => timetableData.some((cls) => cls.day === day))

    return (
      <ScrollView style={styles.dayViewContainer}>
        {daysWithClasses.length > 0 ? (
          daysWithClasses.map((day) => (
            <Card key={day} style={styles.dayCard}>
              <Card.Title title={day} titleStyle={styles.dayCardTitle} />
              <Card.Content>
                {timetableData
                  .filter((cls) => cls.day === day)
                  .sort((a, b) => {
                    // Sort by start time
                    return a.startTime.localeCompare(b.startTime)
                  })
                  .map((cls) => (
                    <TouchableOpacity
                      key={cls.id}
                      style={[styles.dayViewClassCard, { backgroundColor: cls.color }]}
                      onPress={() => {
                        if (userRole === "admin") {
                          navigation.navigate("Edit", { classId: cls.id })
                        }
                      }}
                    >
                      <View style={styles.dayViewClassContent}>
                        <View style={styles.dayViewClassInfo}>
                          <Text style={styles.dayViewClassTitle}>{cls.course}</Text>
                          <Text style={styles.dayViewClassCode}>{cls.courseCode}</Text>
                          <Text style={styles.dayViewClassTime}>
                            {formatTimeForDisplay(cls.startTime)} - {formatTimeForDisplay(cls.endTime)}
                          </Text>
                          <View style={styles.dayViewClassDetails}>
                            <Ionicons name="business-outline" size={14} color={COLORS.textLight} />
                            <Text style={styles.dayViewClassRoom}>{cls.room}</Text>
                          </View>
                          <View style={styles.dayViewClassDetails}>
                            <Ionicons name="school-outline" size={14} color={COLORS.textLight} />
                            <Text style={styles.dayViewClassYear}>
                              Year {cls.year}, Semester {cls.semester}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.dayViewClassBadge}>
                          <Text style={styles.dayViewClassBadgeText}>{cls.lecturer}</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}

                {timetableData.filter((cls) => cls.day === day).length === 0 && (
                  <Text style={styles.emptyDayText}>No classes scheduled for this day.</Text>
                )}
              </Card.Content>
            </Card>
          ))
        ) : (
          <View style={styles.noClassesContainer}>
            <Ionicons name="calendar-outline" size={64} color="#cccccc" />
            <Text style={styles.noClassesText}>No Classes Scheduled</Text>
            <Text style={styles.noClassesSubtext}>There are no classes scheduled for this program yet.</Text>
          </View>
        )}
      </ScrollView>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Semester Timetable</Text>

        <View style={styles.controls}>
          {userRole === "admin" && programs.length > 0 && (
            <View style={styles.programPicker}>
              <Picker
                selectedValue={selectedProgram}
                onValueChange={handleProgramChange}
                style={styles.picker}
                mode="dropdown"
                dropdownIconColor={COLORS.primary}
              >
                {programs.map((program) => (
                  <Picker.Item key={program.id} label={program.name} value={program.id} color={COLORS.text} />
                ))}
              </Picker>
            </View>
          )}

          <View style={styles.viewToggle}>
            <TouchableOpacity
              style={[styles.viewToggleButton, selectedView === "week" && styles.viewToggleButtonActive]}
              onPress={() => setSelectedView("week")}
            >
              <Text style={[styles.viewToggleText, selectedView === "week" && styles.viewToggleTextActive]}>Week</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.viewToggleButton, selectedView === "day" && styles.viewToggleButtonActive]}
              onPress={() => setSelectedView("day")}
            >
              <Text style={[styles.viewToggleText, selectedView === "day" && styles.viewToggleTextActive]}>Day</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Debug mode toggle (hidden in production) */}
      <TouchableOpacity
        style={styles.debugToggle}
        onPress={() => setDebugMode(!debugMode)}
        onLongPress={() => setDebugMode(!debugMode)}
      >
        <Text style={styles.debugToggleText}>{debugMode ? "Hide Debug Info" : ""}</Text>
      </TouchableOpacity>

      {/* Debug information - only show in debug mode */}
      {debugMode && <DebugInfo />}

      {timetableData.length > 0 ? (
        <ScrollView
          style={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {selectedView === "week" ? <WeekView /> : <DayView />}
        </ScrollView>
      ) : (
        <View style={styles.noTimetableContainer}>
          <Ionicons name="calendar-outline" size={64} color="#cccccc" />
          <Text style={styles.noTimetableText}>No Timetable Available</Text>
          <Text style={styles.noTimetableSubtext}>
            {userRole === "admin"
              ? "Generate a timetable from the Generator screen."
              : userRole === "lecturer"
                ? "You don't have any classes scheduled yet."
                : "No classes have been scheduled for your program yet."}
          </Text>
          {userRole === "admin" && (
            <TouchableOpacity style={styles.generateButton} onPress={() => navigation.navigate("Generator")}>
              <Text style={styles.generateButtonText}>Go to Generator</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  )
}

const EditTimetableScreen = ({ route, navigation }) => {
  // FIX: Handle the case when classId is undefined
  const { classId } = route.params || {}
  const [timetableEntry, setTimetableEntry] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!classId) {
      setError("No timetable entry ID provided")
      setLoading(false)
      return
    }
    fetchTimetableEntry()
  }, [classId])

  const fetchTimetableEntry = async () => {
    if (!classId) {
      setError("No timetable entry ID provided")
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const timetableRef = doc(db, "timetable", classId)
      const timetableDoc = await getDoc(timetableRef)

      if (timetableDoc.exists()) {
        setTimetableEntry(timetableDoc.data())
      } else {
        setError("Timetable entry not found")
        Alert.alert("Error", "Timetable entry not found")
        navigation.goBack()
      }
    } catch (error) {
      console.error("Error fetching timetable entry:", error)
      setError("Failed to load timetable entry")
      Alert.alert("Error", "Failed to load timetable entry")
      navigation.goBack()
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading entry details...</Text>
      </View>
    )
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color={COLORS.error} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Card style={styles.editCard}>
        <Card.Title title="Edit Timetable Entry" titleStyle={styles.editCardTitle} />
        <Card.Content>
          <Text style={styles.editLabel}>Class ID:</Text>
          <Text style={styles.editValue}>{classId}</Text>

          {timetableEntry && (
            <>
              <Text style={styles.editLabel}>Day:</Text>
              <Text style={styles.editValue}>{timetableEntry.day}</Text>

              <Text style={styles.editLabel}>Time:</Text>
              <Text style={styles.editValue}>
                {timetableEntry.start_time} - {timetableEntry.end_time}
              </Text>

              <Text style={styles.editLabel}>Course ID:</Text>
              <Text style={styles.editValue}>{timetableEntry.course_id}</Text>

              <Text style={styles.editLabel}>Room ID:</Text>
              <Text style={styles.editValue}>{timetableEntry.room_id}</Text>

              <Text style={styles.editLabel}>Lecturer ID:</Text>
              <Text style={styles.editValue}>{timetableEntry.lecturer_id}</Text>
            </>
          )}

          <Text style={styles.editNote}>Note: Full editing functionality will be implemented in a future update.</Text>

          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </Card.Content>
      </Card>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.textLight,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: COLORS.background,
  },
  errorText: {
    fontSize: 16,
    color: COLORS.error,
    textAlign: "center",
    marginTop: 16,
    marginBottom: 24,
  },
  header: {
    padding: 16,
    backgroundColor: COLORS.primary,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: COLORS.secondary,
    marginBottom: 12,
    textAlign: "center",
  },
  controls: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  programPicker: {
    flex: 1,
    marginRight: 8,
    borderWidth: 1,
    borderColor: COLORS.secondary,
    borderRadius: 4,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
  },
  picker: {
    height: 40,
    color: COLORS.text,
  },
  viewToggle: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: COLORS.secondary,
    borderRadius: 4,
    overflow: "hidden",
  },
  viewToggleButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: "#FFFFFF",
  },
  viewToggleButtonActive: {
    backgroundColor: COLORS.secondary,
  },
  viewToggleText: {
    color: COLORS.text,
  },
  viewToggleTextActive: {
    color: COLORS.primary,
    fontWeight: "bold",
  },
  content: {
    flex: 1,
  },
  // Debug styles
  debugToggle: {
    padding: 4,
    alignItems: "center",
  },
  debugToggleText: {
    fontSize: 12,
    color: COLORS.textLight,
  },
  debugCard: {
    margin: 8,
    backgroundColor: "#fffaf0",
  },
  debugText: {
    fontSize: 12,
    color: COLORS.text,
    marginBottom: 4,
  },
  debugError: {
    fontSize: 12,
    color: COLORS.error,
    marginLeft: 8,
  },
  // Week View Styles
  weekViewContainer: {
    flex: 1,
  },
  weekViewContent: {
    flexDirection: "column",
    minWidth: Dimensions.get("window").width * 2, // Make it scrollable horizontally
  },
  weekHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#f0f0f0",
  },
  timeHeaderCell: {
    width: 80,
    padding: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  dayHeaderCell: {
    flex: 1,
    padding: 8,
    justifyContent: "center",
    alignItems: "center",
    borderLeftWidth: 1,
    borderLeftColor: COLORS.border,
    backgroundColor: COLORS.primary,
  },
  dayHeaderText: {
    fontWeight: "bold",
    color: COLORS.secondary,
  },
  timeRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  timeCell: {
    width: 80,
    padding: 8,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f9f9f9",
  },
  timeText: {
    fontSize: 12,
    color: COLORS.text,
  },
  dayCell: {
    flex: 1,
    minHeight: 80,
    padding: 4,
    borderLeftWidth: 1,
    borderLeftColor: COLORS.border,
  },
  classCard: {
    padding: 8,
    borderRadius: 4,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
    elevation: 2,
  },
  classTitle: {
    fontWeight: "bold",
    fontSize: 12,
    color: COLORS.text,
  },
  classInfo: {
    fontSize: 10,
    color: COLORS.textLight,
  },
  // Day View Styles
  dayViewContainer: {
    flex: 1,
    padding: 16,
  },
  dayCard: {
    marginBottom: 16,
    borderRadius: 8,
    overflow: "hidden",
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  dayCardTitle: {
    color: COLORS.primary,
    fontWeight: "bold",
  },
  dayViewClassCard: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  dayViewClassContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  dayViewClassInfo: {
    flex: 1,
  },
  dayViewClassTitle: {
    fontWeight: "bold",
    fontSize: 16,
    color: COLORS.text,
  },
  dayViewClassCode: {
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 2,
  },
  dayViewClassTime: {
    fontSize: 14,
    marginTop: 4,
    color: COLORS.primary,
    fontWeight: "500",
  },
  dayViewClassDetails: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  dayViewClassRoom: {
    fontSize: 14,
    marginLeft: 4,
    color: COLORS.textLight,
  },
  dayViewClassYear: {
    fontSize: 14,
    marginLeft: 4,
    color: COLORS.textLight,
  },
  dayViewClassBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.7)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dayViewClassBadgeText: {
    fontSize: 12,
    fontWeight: "bold",
    color: COLORS.text,
  },
  emptyDayText: {
    textAlign: "center",
    padding: 16,
    color: COLORS.textLight,
    fontStyle: "italic",
  },
  // No Timetable Styles
  noTimetableContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  noTimetableText: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.textLight,
    marginTop: 16,
  },
  noTimetableSubtext: {
    fontSize: 14,
    color: COLORS.textLight,
    marginTop: 8,
    textAlign: "center",
    marginBottom: 24,
  },
  generateButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  generateButtonText: {
    color: COLORS.secondary,
    fontWeight: "bold",
    fontSize: 16,
  },
  // No Classes Styles
  noClassesContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  noClassesText: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.textLight,
    marginTop: 16,
  },
  noClassesSubtext: {
    fontSize: 14,
    color: COLORS.textLight,
    marginTop: 8,
    textAlign: "center",
  },
  // Edit Screen Styles
  editCard: {
    margin: 16,
    borderRadius: 8,
    overflow: "hidden",
    borderTopWidth: 4,
    borderTopColor: COLORS.primary,
  },
  editCardTitle: {
    color: COLORS.primary,
    fontWeight: "bold",
  },
  editLabel: {
    fontSize: 14,
    color: COLORS.textLight,
    marginTop: 12,
    fontWeight: "500",
  },
  editValue: {
    fontSize: 16,
    color: COLORS.text,
    marginBottom: 8,
    backgroundColor: "#f9f9f9",
    padding: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  editNote: {
    fontSize: 14,
    color: COLORS.textLight,
    fontStyle: "italic",
    marginTop: 16,
    textAlign: "center",
  },
  backButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 20,
  },
  backButtonText: {
    color: COLORS.secondary,
    fontWeight: "bold",
    fontSize: 16,
  },
})

export default TimetableScreen
