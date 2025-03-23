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
import { collection, getDocs, query, where } from "firebase/firestore"

const Stack = createNativeStackNavigator()

const TimetableScreen = ({ route }) => {
  const { userRole } = route.params

  return (
    <Stack.Navigator>
      <Stack.Screen
        name="ViewTimetable"
        component={ViewTimetableScreen}
        options={{ headerShown: false }}
        initialParams={{ userRole }}
      />
      {userRole === "admin" && (
        <Stack.Screen name="Edit" component={EditTimetableScreen} options={{ title: "Edit Timetable" }} />
      )}
    </Stack.Navigator>
  )
}

const ViewTimetableScreen = ({ route, navigation }) => {
  const { userRole } = route.params
  const [currentWeek, setCurrentWeek] = useState("Week 1")
  const [selectedProgram, setSelectedProgram] = useState("")
  const [selectedView, setSelectedView] = useState("week") // 'week' or 'day'
  const [programs, setPrograms] = useState([])
  const [timetableData, setTimetableData] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Days of the week
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]

  // Time slots from 8am to 7pm
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

  useEffect(() => {
    fetchTimetableData()
  }, [])

  const fetchTimetableData = async () => {
    try {
      setLoading(true)
      const user = auth.currentUser
      if (!user) return

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
          setSelectedProgram(studentData.program_id)
          await fetchTimetable(studentData.program_id)
        }
      } else if (userRole === "lecturer") {
        // For lecturers, we'll show their teaching schedule across programs
        await fetchLecturerTimetable(user.uid)
      } else {
        // For admins, show the first program by default
        if (programs.length > 0) {
          setSelectedProgram(programs[0].id)
          await fetchTimetable(programs[0].id)
        }
      }
    } catch (error) {
      console.error("Error fetching timetable data:", error)
      Alert.alert("Error", "Failed to load timetable data. Please try again.")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

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
    } catch (error) {
      console.error("Error fetching programs:", error)
    }
  }

  // Fetch timetable for a specific program
  const fetchTimetable = async (programId) => {
    try {
      const timetableRef = collection(db, "timetable")
      const q = query(timetableRef, where("program_id", "==", programId))
      const timetableSnapshot = await getDocs(q)

      const timetableEntries = []

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

          // Assign a color based on course
          const colors = [
            "#e6f7ff", // light blue
            "#e6ffe6", // light green
            "#f7e6ff", // light purple
            "#fff7e6", // light yellow
            "#ffe6e6", // light red
            "#e6f2ff", // light indigo
          ]

          const colorIndex = timetableEntries.length % colors.length

          timetableEntries.push({
            id: doc.id,
            day: timetableData.day,
            startTime: timetableData.start_time,
            endTime: timetableData.end_time,
            course: courseData.name,
            room: roomData.name,
            capacity: roomData.capacity,
            students: courseData.enrolled_students || 0,
            lecturer: lecturerName,
            program: programs.find((p) => p.id === programId)?.name || "Unknown Program",
            color: colors[colorIndex],
          })
        }
      }

      setTimetableData(timetableEntries)
    } catch (error) {
      console.error("Error fetching timetable:", error)
    }
  }

  // Fetch timetable for a specific lecturer
  const fetchLecturerTimetable = async (userId) => {
    try {
      // Get lecturer ID
      const lecturerRef = collection(db, "lecturers")
      const lecturerQuery = query(lecturerRef, where("user_id", "==", userId))
      const lecturerSnapshot = await getDocs(lecturerQuery)

      if (!lecturerSnapshot.empty) {
        const lecturerId = lecturerSnapshot.docs[0].id

        // Get timetable entries for this lecturer
        const timetableRef = collection(db, "timetable")
        const timetableQuery = query(timetableRef, where("lecturer_id", "==", lecturerId))
        const timetableSnapshot = await getDocs(timetableQuery)

        const timetableEntries = []

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

          // Get program details
          const programRef = collection(db, "programs")
          const programQuery = query(programRef, where("id", "==", timetableData.program_id))
          const programSnapshot = await getDocs(programQuery)

          if (!courseSnapshot.empty && !roomSnapshot.empty && !programSnapshot.empty) {
            const courseData = courseSnapshot.docs[0].data()
            const roomData = roomSnapshot.docs[0].data()
            const programData = programSnapshot.docs[0].data()

            // Assign a color based on course
            const colors = [
              "#e6f7ff", // light blue
              "#e6ffe6", // light green
              "#f7e6ff", // light purple
              "#fff7e6", // light yellow
              "#ffe6e6", // light red
              "#e6f2ff", // light indigo
            ]

            const colorIndex = timetableEntries.length % colors.length

            timetableEntries.push({
              id: doc.id,
              day: timetableData.day,
              startTime: timetableData.start_time,
              endTime: timetableData.end_time,
              course: courseData.name,
              room: roomData.name,
              capacity: roomData.capacity,
              students: courseData.enrolled_students || 0,
              lecturer: "You",
              program: programData.name,
              color: colors[colorIndex],
            })
          }
        }

        setTimetableData(timetableEntries)
      }
    } catch (error) {
      console.error("Error fetching lecturer timetable:", error)
    }
  }

  // Handle program change
  const handleProgramChange = async (programId) => {
    setSelectedProgram(programId)
    await fetchTimetable(programId)
  }

  // Function to get classes for a specific day and time
  const getClassesForTimeSlot = (day, timeSlot) => {
    return timetableData.filter((cls) => cls.day === day && cls.startTime === timeSlot)
  }

  // Function to navigate to previous week
  const previousWeek = () => {
    // Logic to go to previous week
    setCurrentWeek("Week 0")
  }

  // Function to navigate to next week
  const nextWeek = () => {
    // Logic to go to next week
    setCurrentWeek("Week 2")
  }

  const onRefresh = () => {
    setRefreshing(true)
    fetchTimetableData()
  }

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0066cc" />
      </View>
    )
  }

  // Week View Component
  const WeekView = () => (
    <ScrollView horizontal style={styles.weekViewContainer}>
      <View style={styles.weekViewContent}>
        {/* Header row with days */}
        <View style={styles.weekHeaderRow}>
          <View style={styles.timeHeaderCell}></View>
          {days.map((day) => (
            <View key={day} style={styles.dayHeaderCell}>
              <Text style={styles.dayHeaderText}>{day}</Text>
            </View>
          ))}
        </View>

        {/* Time slots rows */}
        {timeSlots.map((timeSlot) => (
          <View key={timeSlot} style={styles.timeRow}>
            <View style={styles.timeCell}>
              <Text style={styles.timeText}>{timeSlot}</Text>
            </View>

            {days.map((day) => {
              const classes = getClassesForTimeSlot(day, timeSlot)
              return (
                <View key={`${day}-${timeSlot}`} style={styles.dayCell}>
                  {classes.map((cls) => (
                    <TouchableOpacity
                      key={cls.id}
                      style={[styles.classCard, { backgroundColor: cls.color }]}
                      onPress={() => (userRole === "admin" ? navigation.navigate("Edit", { classId: cls.id }) : null)}
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

  // Day View Component
  const DayView = () => (
    <ScrollView style={styles.dayViewContainer}>
      {days.map((day) => (
        <Card key={day} style={styles.dayCard}>
          <Card.Title title={day} />
          <Card.Content>
            {timetableData
              .filter((cls) => cls.day === day)
              .sort((a, b) => timeSlots.indexOf(a.startTime) - timeSlots.indexOf(b.startTime))
              .map((cls) => (
                <TouchableOpacity
                  key={cls.id}
                  style={[styles.dayViewClassCard, { backgroundColor: cls.color }]}
                  onPress={() => (userRole === "admin" ? navigation.navigate("Edit", { classId: cls.id }) : null)}
                >
                  <View style={styles.dayViewClassContent}>
                    <View>
                      <Text style={styles.dayViewClassTitle}>{cls.course}</Text>
                      <Text style={styles.dayViewClassTime}>
                        {cls.startTime} - {cls.endTime}
                      </Text>
                      <Text style={styles.dayViewClassRoom}>{cls.room}</Text>
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
      ))}
    </ScrollView>
  )

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.weekNavigation}>
          <TouchableOpacity style={styles.navButton} onPress={previousWeek}>
            <Ionicons name="chevron-back" size={24} color="#0066cc" />
          </TouchableOpacity>

          <Text style={styles.weekText}>{currentWeek}</Text>

          <TouchableOpacity style={styles.navButton} onPress={nextWeek}>
            <Ionicons name="chevron-forward" size={24} color="#0066cc" />
          </TouchableOpacity>
        </View>

        <View style={styles.controls}>
          {userRole === "admin" && (
            <View style={styles.programPicker}>
              <Picker selectedValue={selectedProgram} onValueChange={handleProgramChange} style={styles.picker}>
                {programs.map((program) => (
                  <Picker.Item key={program.id} label={program.name} value={program.id} />
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

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {selectedView === "week" ? <WeekView /> : <DayView />}
      </ScrollView>
    </View>
  )
}

const EditTimetableScreen = ({ route, navigation }) => {
  const { classId } = route.params

  // Implement edit timetable functionality here

  return (
    <View style={styles.container}>
      <Text>Edit Timetable Entry: {classId}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    padding: 16,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  weekNavigation: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  navButton: {
    padding: 8,
  },
  weekText: {
    fontSize: 18,
    fontWeight: "bold",
    marginHorizontal: 16,
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
    borderColor: "#e0e0e0",
    borderRadius: 4,
    backgroundColor: "#ffffff",
  },
  picker: {
    height: 40,
  },
  viewToggle: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 4,
    overflow: "hidden",
  },
  viewToggleButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: "#ffffff",
  },
  viewToggleButtonActive: {
    backgroundColor: "#0066cc",
  },
  viewToggleText: {
    color: "#333333",
  },
  viewToggleTextActive: {
    color: "#ffffff",
    fontWeight: "bold",
  },
  content: {
    flex: 1,
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
    borderLeftColor: "#e0e0e0",
  },
  dayHeaderText: {
    fontWeight: "bold",
  },
  timeRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
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
  },
  dayCell: {
    flex: 1,
    minHeight: 80,
    padding: 4,
    borderLeftWidth: 1,
    borderLeftColor: "#e0e0e0",
  },
  classCard: {
    padding: 4,
    borderRadius: 4,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  classTitle: {
    fontWeight: "bold",
    fontSize: 12,
  },
  classInfo: {
    fontSize: 10,
  },
  // Day View Styles
  dayViewContainer: {
    flex: 1,
    padding: 16,
  },
  dayCard: {
    marginBottom: 16,
  },
  dayViewClassCard: {
    padding: 12,
    borderRadius: 4,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  dayViewClassContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  dayViewClassTitle: {
    fontWeight: "bold",
    fontSize: 16,
  },
  dayViewClassTime: {
    fontSize: 14,
    marginTop: 4,
  },
  dayViewClassRoom: {
    fontSize: 14,
    marginTop: 2,
  },
  dayViewClassBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.7)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  dayViewClassBadgeText: {
    fontSize: 12,
    fontWeight: "bold",
  },
  emptyDayText: {
    textAlign: "center",
    padding: 16,
    color: "#666666",
  },
})

export default TimetableScreen

