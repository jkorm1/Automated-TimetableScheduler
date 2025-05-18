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
  Alert,
  Image,
} from "react-native"
import { Card } from "react-native-paper"
import { Ionicons } from "@expo/vector-icons"
import { auth, db } from "../firebaseConfig"
import { collection, getDocs, query, where, limit } from "firebase/firestore"

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

const DashboardScreen = ({ route, navigation }) => {
  const { userRole } = route.params
  const [userName, setUserName] = useState("")
  const [userProgram, setUserProgram] = useState("")
  const [upcomingClasses, setUpcomingClasses] = useState([])
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [programTimetableStatus, setProgramTimetableStatus] = useState([])

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      const user = auth.currentUser
      if (!user) return

      // Get user data
      const userRef = collection(db, "users")
      const q = query(userRef, where("email", "==", user.email))
      const querySnapshot = await getDocs(q)

      if (!querySnapshot.empty) {
        const userData = querySnapshot.docs[0].data()
        setUserName(userData.name || user.displayName || "User")

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

        // Get upcoming classes
        await fetchUpcomingClasses(user.uid, userData.role)

        // Get notifications
        await fetchNotifications(user.uid)

        // Get timetable status for admin
        if (userData.role === "admin") {
          await fetchTimetableStatus()
        }
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error)
      Alert.alert("Error", "Failed to load dashboard data. Please try again.")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

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
              capacity: roomData.capacity,
              students: courseData.enrolled_students || 0,
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

  const fetchTimetableStatus = async () => {
    try {
      // Get all programs
      const programsRef = collection(db, "programs")
      const programsSnapshot = await getDocs(programsRef)

      const programsData = []

      for (const programDoc of programsSnapshot.docs) {
        const programData = programDoc.data()

        // Check if this program has a timetable
        const timetableRef = collection(db, "timetable")
        const timetableQuery = query(timetableRef, where("program_id", "==", programDoc.id), limit(1))
        const timetableSnapshot = await getDocs(timetableQuery)

        const hasTimetable = !timetableSnapshot.empty

        programsData.push({
          id: programDoc.id,
          name: programData.name,
          status: hasTimetable ? "Generated" : "Pending",
        })
      }

      setProgramTimetableStatus(programsData)
    } catch (error) {
      console.error("Error fetching timetable status:", error)
    }
  }

  const fetchNotifications = async (userId) => {
    try {
      // In a real app, you would fetch notifications from Firestore
      // For now, we'll use a more realistic approach with timestamps

      // Check if there are any timetable entries
      const timetableRef = collection(db, "timetable")
      const timetableQuery = query(timetableRef, limit(1))
      const timetableSnapshot = await getDocs(timetableQuery)

      const notifications = []

      if (!timetableSnapshot.empty) {
        notifications.push({
          id: 1,
          message: "Timetable is now available",
          time: "2 hours ago",
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
        })
      }

      // Add some generic notifications
      notifications.push({
        id: 2,
        message: "Welcome to UniScheduler",
        time: "1 day ago",
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
      })

      // Sort by timestamp (newest first)
      notifications.sort((a, b) => b.timestamp - a.timestamp)

      setNotifications(notifications)
    } catch (error) {
      console.error("Error fetching notifications:", error)
    }
  }

  const onRefresh = () => {
    setRefreshing(true)
    fetchDashboardData()
  }

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <Image source={require("../assets/knust-logo.png")} style={styles.logo} resizeMode="contain" />
        <Text style={styles.welcomeText}>Welcome, {userName}</Text>
        <Text style={styles.subText}>
          {userRole === "student"
            ? `Program: ${userProgram}`
            : userRole === "lecturer"
              ? "Your teaching schedule"
              : "University Timetable Administration"}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Today's Schedule</Text>
        {upcomingClasses.length > 0 ? (
          upcomingClasses.map((cls) => (
            <Card key={cls.id} style={styles.card}>
              <Card.Content>
                <Text style={styles.cardTitle}>{cls.course}</Text>
                <Text style={styles.cardSubtitle}>{cls.room}</Text>
                <Text style={styles.cardSubtitle}>{cls.time}</Text>

                <View style={styles.cardFooter}>
                  {userRole === "student" && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{cls.lecturer}</Text>
                    </View>
                  )}

                  {userRole === "admin" && (
                    <View
                      style={[
                        styles.badge,
                        cls.students / cls.capacity > 0.9
                          ? styles.redBadge
                          : cls.students / cls.capacity > 0.7
                            ? styles.yellowBadge
                            : styles.greenBadge,
                      ]}
                    >
                      <Text style={styles.badgeText}>
                        {cls.students}/{cls.capacity} students
                      </Text>
                    </View>
                  )}
                </View>
              </Card.Content>
            </Card>
          ))
        ) : (
          <Text style={styles.emptyText}>No classes scheduled for today.</Text>
        )}

        <TouchableOpacity style={styles.viewAllButton} onPress={() => navigation.navigate("Timetable")}>
          <Text style={styles.viewAllText}>View Full Timetable</Text>
        </TouchableOpacity>
      </View>

      {userRole === "lecturer" && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Attendance</Text>
          {upcomingClasses.map((cls) => (
            <Card key={cls.id} style={styles.card}>
              <Card.Content>
                <Text style={styles.cardTitle}>{cls.course}</Text>
                <Text style={styles.cardSubtitle}>{cls.time}</Text>

                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() =>
                    navigation.navigate("Attendance", {
                      screen: "TakeAttendance",
                      params: { classId: cls.id },
                    })
                  }
                >
                  <Text style={styles.actionButtonText}>Take Attendance</Text>
                </TouchableOpacity>
              </Card.Content>
            </Card>
          ))}
        </View>
      )}

      {userRole === "student" && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Attendance Status</Text>
          {upcomingClasses.length > 0 ? (
            upcomingClasses.map((cls) => (
              <Card key={cls.id} style={styles.card}>
                <Card.Content>
                  <View style={styles.rowBetween}>
                    <View>
                      <Text style={styles.cardTitle}>{cls.course}</Text>
                      <Text style={styles.cardSubtitle}>Last week: 2/2 classes</Text>
                    </View>
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>90%</Text>
                    </View>
                  </View>
                </Card.Content>
              </Card>
            ))
          ) : (
            <Text style={styles.emptyText}>No attendance records available.</Text>
          )}

          <TouchableOpacity
            style={styles.viewAllButton}
            onPress={() => navigation.navigate("Attendance", { screen: "History" })}
          >
            <Text style={styles.viewAllText}>View Full History</Text>
          </TouchableOpacity>
        </View>
      )}

      {userRole === "admin" && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Timetable Status</Text>
          {programTimetableStatus.length > 0 ? (
            programTimetableStatus.map((program) => (
              <Card key={program.id} style={styles.card}>
                <Card.Content>
                  <View style={styles.rowBetween}>
                    <Text>{program.name}</Text>
                    <View
                      style={[styles.badge, program.status === "Generated" ? styles.greenBadge : styles.yellowBadge]}
                    >
                      <Text style={styles.badgeText}>{program.status}</Text>
                    </View>
                  </View>
                </Card.Content>
              </Card>
            ))
          ) : (
            <Text style={styles.emptyText}>No programs found.</Text>
          )}

          <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate("Generator")}>
            <Text style={styles.primaryButtonText}>Generate Timetables</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActions}>
          {userRole === "student" && (
            <>
              <TouchableOpacity style={styles.quickActionButton} onPress={() => navigation.navigate("Timetable")}>
                <Ionicons name="calendar-outline" size={24} color={COLORS.primary} />
                <Text style={styles.quickActionText}>View Timetable</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickActionButton}
                onPress={() => navigation.navigate("Attendance", { screen: "Submit" })}
              >
                <Ionicons name="checkbox-outline" size={24} color={COLORS.primary} />
                <Text style={styles.quickActionText}>Submit Attendance</Text>
              </TouchableOpacity>
            </>
          )}

          {userRole === "lecturer" && (
            <>
              <TouchableOpacity style={styles.quickActionButton} onPress={() => navigation.navigate("Timetable")}>
                <Ionicons name="calendar-outline" size={24} color={COLORS.primary} />
                <Text style={styles.quickActionText}>View Timetable</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.quickActionButton} onPress={() => navigation.navigate("Attendance")}>
                <Ionicons name="checkbox-outline" size={24} color={COLORS.primary} />
                <Text style={styles.quickActionText}>Take Attendance</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickActionButton}
                onPress={() => navigation.navigate("Settings", { screen: "Preferences" })}
              >
                <Ionicons name="settings-outline" size={24} color={COLORS.primary} />
                <Text style={styles.quickActionText}>Time Preferences</Text>
              </TouchableOpacity>
            </>
          )}

          {userRole === "admin" && (
            <>
              <TouchableOpacity style={styles.quickActionButton} onPress={() => navigation.navigate("Generator")}>
                <Ionicons name="settings-outline" size={24} color={COLORS.primary} />
                <Text style={styles.quickActionText}>Generate</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.quickActionButton} onPress={() => navigation.navigate("Timetable")}>
                <Ionicons name="calendar-outline" size={24} color={COLORS.primary} />
                <Text style={styles.quickActionText}>View Timetable</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.quickActionButton} onPress={() => navigation.navigate("Rooms")}>
                <Ionicons name="business-outline" size={24} color={COLORS.primary} />
                <Text style={styles.quickActionText}>Manage Rooms</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Notifications</Text>
        {notifications.length > 0 ? (
          notifications.map((notification) => (
            <Card key={notification.id} style={styles.card}>
              <Card.Content>
                <View style={styles.notificationRow}>
                  <View style={styles.notificationIcon}>
                    <Ionicons name="notifications-outline" size={20} color={COLORS.primary} />
                  </View>
                  <View style={styles.notificationContent}>
                    <Text style={styles.notificationText}>{notification.message}</Text>
                    <Text style={styles.notificationTime}>{notification.time}</Text>
                  </View>
                </View>
              </Card.Content>
            </Card>
          ))
        ) : (
          <Text style={styles.emptyText}>No notifications available.</Text>
        )}
      </View>
    </ScrollView>
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
  header: {
    padding: 16,
    backgroundColor: COLORS.primary,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    alignItems: "center",
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: 10,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: "bold",
    color: COLORS.secondary,
    textAlign: "center",
  },
  subText: {
    fontSize: 16,
    color: "#FFFFFF",
    marginTop: 4,
    textAlign: "center",
  },
  section: {
    padding: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
    color: COLORS.primary,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.secondary,
    paddingLeft: 8,
  },
  card: {
    marginBottom: 12,
    elevation: 2,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: COLORS.text,
  },
  cardSubtitle: {
    fontSize: 14,
    color: COLORS.textLight,
    marginTop: 4,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 8,
  },
  badge: {
    backgroundColor: "#e0e0e0",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  greenBadge: {
    backgroundColor: "#e6ffe6",
    borderWidth: 1,
    borderColor: COLORS.success,
  },
  yellowBadge: {
    backgroundColor: "#fff8e6",
    borderWidth: 1,
    borderColor: COLORS.warning,
  },
  redBadge: {
    backgroundColor: "#ffe6e6",
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  badgeText: {
    fontSize: 12,
    color: COLORS.text,
    fontWeight: "500",
  },
  emptyText: {
    textAlign: "center",
    color: COLORS.textLight,
    marginVertical: 16,
    fontStyle: "italic",
  },
  viewAllButton: {
    alignItems: "center",
    marginTop: 12,
  },
  viewAllText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: "500",
  },
  actionButton: {
    backgroundColor: COLORS.primary,
    padding: 10,
    borderRadius: 4,
    alignItems: "center",
    marginTop: 8,
  },
  actionButtonText: {
    color: "#ffffff",
    fontWeight: "bold",
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  primaryButtonText: {
    color: COLORS.secondary,
    fontWeight: "bold",
    fontSize: 16,
  },
  quickActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  quickActionButton: {
    width: "48%",
    backgroundColor: COLORS.cardBackground,
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 12,
    elevation: 2,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  quickActionText: {
    marginTop: 8,
    color: COLORS.text,
    fontWeight: "bold",
  },
  notificationRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  notificationIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#e6f0ff",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
  },
  notificationText: {
    fontSize: 14,
    color: COLORS.text,
  },
  notificationTime: {
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 4,
  },
})

export default DashboardScreen
