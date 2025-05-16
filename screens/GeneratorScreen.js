"use client"

import { useState, useEffect } from "react"
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Switch,
  TextInput,
  FlatList,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { Card } from "react-native-paper"
import { db } from "../firebaseConfig"
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  serverTimestamp,
  getDoc,
  writeBatch,
} from "firebase/firestore"
import { useNavigation } from "@react-navigation/native"

const GeneratorScreen = () => {
  const navigation = useNavigation()
  
  // State for programs and courses
  const [programs, setPrograms] = useState([])
  const [selectedProgram, setSelectedProgram] = useState(null)
  const [courses, setCourses] = useState([])
  const [lecturers, setLecturers] = useState([])
  const [rooms, setRooms] = useState([])
  
  // State for generation settings
  const [settings, setSettings] = useState({
    prioritizeRoomSize: true,
    avoidBackToBack: true,
    balanceLecturerLoad: true,
    maxDailyHours: 8,
    preferredStartTime: "08:00",
    preferredEndTime: "18:00",
    allowWeekends: false,
    spreadCoursesAcrossDays: true,
    maxSessionsPerDay: 3,
    respectCreditHours: true,
  })
  
  // State for generation process
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationProgress, setGenerationProgress] = useState(0)
  const [generationStep, setGenerationStep] = useState("")
  const [conflicts, setConflicts] = useState([])
  
  // State for generated timetable
  const [timetable, setTimetable] = useState([])
  const [showTimetable, setShowTimetable] = useState(false)
  
  // State for UI
  const [activeTab, setActiveTab] = useState("settings") // settings, conflicts, preview
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPrograms()
    fetchLecturers()
    fetchRooms()
  }, [])

  const fetchPrograms = async () => {
    try {
      const programsRef = collection(db, "programs")
      const programsSnapshot = await getDocs(programsRef)
      
      const programsList = []
      programsSnapshot.forEach((doc) => {
        programsList.push({
          id: doc.id,
          ...doc.data(),
        })
      })
      
      setPrograms(programsList)
      setLoading(false)
    } catch (error) {
      console.error("Error fetching programs:", error)
      Alert.alert("Error", "Failed to load programs")
      setLoading(false)
    }
  }

  // Fetch lecturers from Firestore
  const fetchLecturers = async () => {
    try {
      console.log("Starting to fetch lecturers...")
      setLoading(true)
      
      const lecturersRef = collection(db, "lecturers")
      const lecturersSnapshot = await getDocs(lecturersRef)
      
      console.log(`Found ${lecturersSnapshot.docs.length} lecturer documents in Firestore`)

      const lecturersData = []

      for (const doc of lecturersSnapshot.docs) {
        try {
          const lecturerData = doc.data()
          
          // Skip lecturers without a user_id
          if (!lecturerData.user_id) {
            console.log(`Skipping lecturer ${doc.id} - missing user_id field`)
            continue
          }

          let lecturerName = "Unknown"
          let lecturerEmail = ""
          
          // Get user data for lecturer name
          try {
            const userRef = collection(db, "users")
            const q = query(userRef, where("id", "==", lecturerData.user_id))
            const userSnapshot = await getDocs(q)
            
            if (!userSnapshot.empty) {
              const userData = userSnapshot.docs[0].data()
              lecturerName = userData.name || "Unknown"
              lecturerEmail = userData.email || ""
            } else {
              console.log(`No user found for lecturer ${doc.id} with user_id ${lecturerData.user_id}`)
            }
          } catch (userError) {
            console.error(`Error fetching user data for lecturer ${doc.id}:`, userError)
          }

          // Get courses taught by this lecturer
          const coursesTaught = []
          try {
            const coursesRef = collection(db, "courses")
            const coursesSnapshot = await getDocs(coursesRef)

            coursesSnapshot.forEach((courseDoc) => {
              const courseData = courseDoc.data()
              if (courseData.lecturer_id === lecturerData.user_id) {
                coursesTaught.push({
                  id: courseDoc.id,
                  name: courseData.name || "Unnamed Course",
                  code: courseData.code || "",
                  credit_hours: courseData.credit_hours || 3
                })
              }
            })
          } catch (coursesError) {
            console.error(`Error fetching courses for lecturer ${doc.id}:`, coursesError)
          }

          // Ensure unavailable_times is properly handled
          let unavailableTimes = []
          if (lecturerData.unavailable_times && Array.isArray(lecturerData.unavailable_times)) {
            unavailableTimes = lecturerData.unavailable_times
          } else if (lecturerData.unavailableTimes && Array.isArray(lecturerData.unavailableTimes)) {
            // Handle case where it might be named differently
            unavailableTimes = lecturerData.unavailableTimes
          }

          // Create the lecturer object with all necessary data
          lecturersData.push({
            id: doc.id,
            name: lecturerName,
            email: lecturerEmail,
            courses: coursesTaught,
            unavailableTimes: unavailableTimes,
            department: lecturerData.department || "",
            specialization: lecturerData.specialization || "",
            max_hours_per_week: lecturerData.max_hours_per_week || 20,
            max_courses: lecturerData.max_courses || 5,
            user_id: lecturerData.user_id,
            ...lecturerData
          })
        } catch (lecturerError) {
          console.error(`Error processing lecturer ${doc.id}:`, lecturerError)
        }
      }

      console.log(`Successfully processed ${lecturersData.length} valid lecturers`)
      setLecturers(lecturersData)
      
      if (lecturersData.length === 0) {
        console.warn("No valid lecturers found with user_id field")
      }
    } catch (error) {
      console.error("Error fetching lecturers:", error)
      Alert.alert(
        "Error",
        "Failed to load lecturers. Please try again later.",
        [{ text: "OK" }]
      )
    } finally {
      setLoading(false)
    }
  }

  const fetchRooms = async () => {
    try {
      const roomsRef = collection(db, "rooms")
      const roomsSnapshot = await getDocs(roomsRef)
      
      const roomsList = []
      roomsSnapshot.forEach((doc) => {
        roomsList.push({
          id: doc.id,
          ...doc.data(),
          name: doc.data().name || `Room ${doc.id.substring(0, 4)}`,
          capacity: doc.data().capacity || 30,
        })
      })
      
      // Sort rooms by capacity (largest to smallest)
      roomsList.sort((a, b) => (b.capacity || 0) - (a.capacity || 0))
      
      setRooms(roomsList)
      console.log(`Fetched ${roomsList.length} rooms`)
    } catch (error) {
      console.error("Error fetching rooms:", error)
      Alert.alert("Error", "Failed to load rooms")
    }
  }

  const fetchCourses = async (programId) => {
    try {
      const coursesRef = collection(db, "courses")
      const q = query(coursesRef, where("program_id", "==", programId))
      const coursesSnapshot = await getDocs(q)
      
      const coursesList = []
      coursesSnapshot.forEach((doc) => {
        const courseData = doc.data()
        coursesList.push({
          id: doc.id,
          ...courseData,
          name: courseData.name || `Course ${doc.id.substring(0, 4)}`,
          code: courseData.code || "N/A",
          credit_hours: courseData.credit_hours || 3,
          year: courseData.year || 1,
          semester: courseData.semester || 1,
          expected_students: courseData.expected_students || courseData.enrolled_students || 20,
          selected: true, // Default all courses to be included
        })
      })
      
      // Sort courses by year, semester, and credit hours
      coursesList.sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year
        if (a.semester !== b.semester) return a.semester - b.semester
        return b.credit_hours - a.credit_hours // Higher credit hours first
      })
      
      setCourses(coursesList)
      console.log(`Fetched ${coursesList.length} courses for program ${programId}`)
    } catch (error) {
      console.error("Error fetching courses:", error)
      Alert.alert("Error", "Failed to load courses for this program")
    }
  }

  const handleProgramSelect = (program) => {
    setSelectedProgram(program)
    fetchCourses(program.id)
    setShowTimetable(false)
    setConflicts([])
    setActiveTab("settings")
  }

  const toggleCourseSelection = (courseId) => {
    setCourses(
      courses.map((course) => 
        course.id === courseId 
          ? { ...course, selected: !course.selected } 
          : course
      )
    )
  }

  const updateSetting = (key, value) => {
    setSettings({
      ...settings,
      [key]: value,
    })
  }

  const validateSettings = () => {
    const selectedCourses = courses.filter(course => course.selected)
    
    if (selectedCourses.length === 0) {
      Alert.alert("Error", "Please select at least one course to include in the timetable")
      return false
    }
    
    if (rooms.length === 0) {
      Alert.alert("Error", "No rooms available. Please add rooms before generating a timetable")
      return false
    }
    
    if (lecturers.length === 0) {
      Alert.alert("Error", "No lecturers available. Please add lecturers before generating a timetable")
      return false
    }
    
    // Check if all selected courses have assigned lecturers
    const coursesWithoutLecturers = selectedCourses.filter(course => !course.lecturer_id)
    if (coursesWithoutLecturers.length > 0) {
      const courseNames = coursesWithoutLecturers.map(c => c.name).join(", ")
      Alert.alert(
        "Warning", 
        `The following courses don't have assigned lecturers: ${courseNames}. Lecturers will be assigned automatically.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Continue", onPress: () => generateTimetableInternal() }
        ]
      )
      return false
    }
    
    return true
  }

  const generateTimetable = async () => {
    if (validateSettings()) {
      generateTimetableInternal()
    }
  }

  const generateTimetableInternal = async () => {
    try {
      setIsGenerating(true)
      setGenerationProgress(0)
      setGenerationStep("Initializing timetable generation...")
      setActiveTab("conflicts")
      setConflicts([])
      setTimetable([])
      
      // Step 1: Get selected courses
      const selectedCourses = courses.filter(course => course.selected)
      setGenerationProgress(5)
      setGenerationStep("Analyzing course requirements...")
      
      // Step 2: Create time slots
      const days = settings.allowWeekends 
        ? ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] 
        : ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
      
      // Parse start and end times
      const startHour = parseInt(settings.preferredStartTime.split(":")[0])
      const endHour = parseInt(settings.preferredEndTime.split(":")[0])
      
      // Generate all possible time slots
      const timeSlots = []
      for (const day of days) {
        for (let hour = startHour; hour < endHour; hour++) {
          const startTime = `${hour.toString().padStart(2, "0")}:00`
          const endTime = `${(hour + 1).toString().padStart(2, "0")}:00`
          timeSlots.push({
            day,
            startTime,
            endTime,
            key: `${day}-${startTime}`
          })
        }
      }
      
      setGenerationProgress(10)
      setGenerationStep("Preparing scheduling constraints...")
      
      // Step 3: Sort courses by priority
      // Priority: Higher year > Higher semester > Higher credit hours > More students
      const prioritizedCourses = [...selectedCourses].sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year
        if (a.semester !== b.semester) return b.semester - a.semester
        if (a.credit_hours !== b.credit_hours) return b.credit_hours - a.credit_hours
        return (b.expected_students || 0) - (a.expected_students || 0)
      })
      
      console.log("Courses sorted by priority:", prioritizedCourses.map(c => `${c.name} (Y${c.year}S${c.semester}, ${c.credit_hours}cr)`))
      
      // Step 4: Initialize scheduling data structures
      
      // Track which time slots are used for each room
      const roomSchedule = {}
      rooms.forEach(room => {
        roomSchedule[room.id] = {}
        timeSlots.forEach(slot => {
          roomSchedule[room.id][slot.key] = false
        })
      })
      
      // Track which time slots are used for each lecturer
      const lecturerSchedule = {}
      lecturers.forEach(lecturer => {
        lecturerSchedule[lecturer.id] = {
          slots: {},
          dailyHours: {},
          totalHours: 0,
          courseCount: 0
        }
        
        // Initialize slots
        timeSlots.forEach(slot => {
          lecturerSchedule[lecturer.id].slots[slot.key] = false
        })
        
        // Initialize daily hours
        days.forEach(day => {
          lecturerSchedule[lecturer.id].dailyHours[day] = 0
        })
        
        // Mark unavailable times
        if (lecturer.unavailableTimes && lecturer.unavailableTimes.length > 0) {
          lecturer.unavailableTimes.forEach(unavailable => {
            const key = `${unavailable.day}-${unavailable.time}`
            lecturerSchedule[lecturer.id].slots[key] = true
          })
        }
      })
      
      // Track which time slots are used for each student group (year/semester)
      const studentGroupSchedule = {}
      
      // Initialize student group schedules
      prioritizedCourses.forEach(course => {
        const groupKey = `Y${course.year}S${course.semester}`
        if (!studentGroupSchedule[groupKey]) {
          studentGroupSchedule[groupKey] = {}
          timeSlots.forEach(slot => {
            studentGroupSchedule[groupKey][slot.key] = false
          })
        }
      })
      
      // Track course sessions already scheduled
      const courseSessionsScheduled = {}
      prioritizedCourses.forEach(course => {
        courseSessionsScheduled[course.id] = 0
      })
      
      setGenerationProgress(15)
      setGenerationStep("Allocating courses to time slots...")
      
      // Step 5: Generate the timetable
      const generatedTimetable = []
      const currentConflicts = []
      
      // For each course, calculate how many sessions we need
      prioritizedCourses.forEach(course => {
        // Calculate required sessions based on credit hours
        // Typically 1 credit hour = 1 hour of class time per week
        const creditHours = course.credit_hours || 3
        const sessionsNeeded = settings.respectCreditHours ? 
          Math.ceil(creditHours / 2) : // Assuming 2-hour sessions
          Math.ceil(creditHours / 3)   // Or 3-hour sessions if not respecting credit hours exactly
        
        course.sessionsNeeded = sessionsNeeded
        course.sessionsScheduled = 0
        
        console.log(`Course ${course.name}: needs ${sessionsNeeded} sessions for ${creditHours} credit hours`)
      })
      
      // Function to find the best lecturer for a course
      const findBestLecturer = (course) => {
        // If course already has an assigned lecturer, use that
        if (course.lecturer_id) {
          const assignedLecturer = lecturers.find(l => l.user_id === course.lecturer_id)
          if (assignedLecturer) {
            return assignedLecturer
          }
        }
        
        // Otherwise, find the least busy lecturer
        if (settings.balanceLecturerLoad) {
          return lecturers.reduce((leastBusy, current) => {
            const leastBusyLoad = lecturerSchedule[leastBusy.id].totalHours
            const currentLoad = lecturerSchedule[current.id].totalHours
            return currentLoad < leastBusyLoad ? current : leastBusy
          }, lecturers[0])
        }
        
        // Default to first lecturer if no other criteria
        return lecturers[0]
      }
      
      // Function to find the best room for a course
      const findBestRoom = (course, timeSlot) => {
        // Filter rooms that are available at this time slot
        const availableRooms = rooms.filter(room => !roomSchedule[room.id][timeSlot.key])
        
        if (availableRooms.length === 0) return null
        
        // If prioritizing room size, find the smallest room that fits
        if (settings.prioritizeRoomSize) {
          // Sort by capacity (smallest to largest)
          const sortedBySize = [...availableRooms].sort((a, b) => (a.capacity || 0) - (b.capacity || 0))
          
          // Find the smallest room that fits the class
          const expectedStudents = course.expected_students || course.enrolled_students || 20
          const suitableRoom = sortedBySize.find(room => (room.capacity || 0) >= expectedStudents)
          
          return suitableRoom || sortedBySize[sortedBySize.length - 1] // Return largest if none fit
        }
        
        // Otherwise, just return the first available room
        return availableRooms[0]
      }
      
      // Function to check if a time slot works for a course
      const isTimeSlotSuitable = (course, timeSlot, lecturer) => {
        const groupKey = `Y${course.year}S${course.semester}`
        
        // Check if student group is already scheduled at this time
        if (studentGroupSchedule[groupKey][timeSlot.key]) {
          return false
        }
        
        // Check if lecturer is available
        if (lecturerSchedule[lecturer.id].slots[timeSlot.key]) {
          return false
        }
        
        // Check if lecturer has reached max daily hours
        if (lecturerSchedule[lecturer.id].dailyHours[timeSlot.day] >= settings.maxDailyHours) {
          return false
        }
        
        // If avoiding back-to-back classes, check adjacent slots
        if (settings.avoidBackToBack) {
          // Get hour from time slot
          const hour = parseInt(timeSlot.startTime.split(":")[0])
          
          // Check previous hour
          const prevHour = `${(hour - 1).toString().padStart(2, "0")}:00`
          const prevSlotKey = `${timeSlot.day}-${prevHour}`
          
          // Check next hour
          const nextHour = `${(hour + 1).toString().padStart(2, "0")}:00`
          const nextSlotKey = `${timeSlot.day}-${nextHour}`
          
          // If lecturer has class in adjacent slots, avoid this slot
          if (lecturerSchedule[lecturer.id].slots[prevSlotKey] || 
              lecturerSchedule[lecturer.id].slots[nextSlotKey]) {
            return false
          }
        }
        
        // If spreading courses across days, check if this course already has a session on this day
        if (settings.spreadCoursesAcrossDays) {
          const sessionsOnThisDay = generatedTimetable.filter(
            entry => entry.course_id === course.id && entry.day === timeSlot.day
          ).length
          
          if (sessionsOnThisDay >= settings.maxSessionsPerDay) {
            return false
          }
        }
        
        return true
      }
      
      // Schedule each course
      for (let i = 0; i < prioritizedCourses.length; i++) {
        const course = prioritizedCourses[i]
        setGenerationStep(`Scheduling ${course.name} (${i+1}/${prioritizedCourses.length})...`)
        
        // Find the best lecturer for this course
        const lecturer = findBestLecturer(course)
        
        // Schedule each session needed for this course
        for (let session = 0; session < course.sessionsNeeded; session++) {
          let scheduled = false
          
          // Try each time slot
          for (const timeSlot of timeSlots) {
            // Check if this time slot works
            if (isTimeSlotSuitable(course, timeSlot, lecturer)) {
              // Find the best room
              const room = findBestRoom(course, timeSlot)
              
              if (room) {
                // We found a suitable slot! Schedule the class
                const timetableEntry = {
                  id: `${course.id}-${session}`,
                  course_id: course.id,
                  course_name: course.name || "Unnamed Course",
                  course_code: course.code || "N/A",
                  lecturer_id: lecturer.id,
                  lecturer_name: lecturer.name || "Unknown",
                  room_id: room.id,
                  room_name: room.name || "Unknown Room",
                  day: timeSlot.day,
                  start_time: timeSlot.startTime,
                  end_time: timeSlot.endTime,
                  program_id: selectedProgram.id,
                  program_name: selectedProgram.name,
                  year: course.year || 1,
                  semester: course.semester || 1,
                  credit_hours: course.credit_hours || 3,
                  expected_students: course.expected_students || 20,
                }
                
                // Add to timetable
                generatedTimetable.push(timetableEntry)
                
                // Mark resources as used
                roomSchedule[room.id][timeSlot.key] = true
                lecturerSchedule[lecturer.id].slots[timeSlot.key] = true
                lecturerSchedule[lecturer.id].dailyHours[timeSlot.day]++
                lecturerSchedule[lecturer.id].totalHours++
                lecturerSchedule[lecturer.id].courseCount++
                
                const groupKey = `Y${course.year}S${course.semester}`
                studentGroupSchedule[groupKey][timeSlot.key] = true
                
                course.sessionsScheduled++
                courseSessionsScheduled[course.id]++
                
                scheduled = true
                break
              }
            }
          }
          
          // If couldn't schedule this session, add to conflicts
          if (!scheduled) {
            currentConflicts.push({
              type: "scheduling",
              course_id: course.id,
              course_name: course.name || "Unnamed Course",
              lecturer_id: lecturer.id,
              lecturer_name: lecturer.name || "Unknown",
              message: `Could not schedule session ${session + 1}/${course.sessionsNeeded} for ${course.name}. No suitable time slot found.`,
            })
          }
        }
        
        // Update progress
        setGenerationProgress(15 + Math.floor(70 * (i + 1) / prioritizedCourses.length))
      }
      
      setGenerationProgress(85)
      setGenerationStep("Checking for conflicts...")
      
      // Check for courses that couldn't be fully scheduled
      prioritizedCourses.forEach(course => {
        if (course.sessionsScheduled < course.sessionsNeeded) {
          currentConflicts.push({
            type: "incomplete",
            course_id: course.id,
            course_name: course.name || "Unnamed Course",
            message: `Only scheduled ${course.sessionsScheduled}/${course.sessionsNeeded} sessions for ${course.name}.`,
          })
        }
      })
      
      // Check for any overlapping classes for the same year/semester (double-check)
      const yearSemesterGroups = {}
      
      generatedTimetable.forEach(entry => {
        const key = `Y${entry.year}S${entry.semester}-${entry.day}-${entry.start_time}`
        if (!yearSemesterGroups[key]) {
          yearSemesterGroups[key] = []
        }
        yearSemesterGroups[key].push(entry)
      })
      
      // Check each group for time conflicts
      Object.entries(yearSemesterGroups).forEach(([key, entries]) => {
        if (entries.length > 1) {
          currentConflicts.push({
            type: "overlap",
            entries: entries,
            message: `Time conflict: ${entries.length} classes scheduled at the same time (${entries[0].day} ${entries[0].start_time}) for Year ${entries[0].year}, Semester ${entries[0].semester}`,
          })
        }
      })
      
      setGenerationProgress(95)
      setGenerationStep("Finalizing timetable...")
      
      // Save the generated timetable
      setTimetable(generatedTimetable)
      setConflicts(currentConflicts)
      
      console.log(`Generated timetable with ${generatedTimetable.length} entries and ${currentConflicts.length} conflicts`)
      
      // If no conflicts, show the preview
      if (currentConflicts.length === 0) {
        setActiveTab("preview")
        setShowTimetable(true)
      }
      
      setGenerationProgress(100)
      setGenerationStep("Timetable generation complete!")
      
    } catch (error) {
      console.error("Error generating timetable:", error)
      Alert.alert("Error", "Failed to generate timetable: " + error.message)
    } finally {
      setIsGenerating(false)
    }
  }

  const saveTimetable = async () => {
    if (timetable.length === 0) {
      Alert.alert("Error", "No timetable to save")
      return
    }
    
    try {
      setLoading(true)
      
      // First, delete any existing timetable entries for this program
      const timetableRef = collection(db, "timetable")
      const q = query(timetableRef, where("program_id", "==", selectedProgram.id))
      const existingEntries = await getDocs(q)
      
      const batch = writeBatch(db)
      
      existingEntries.forEach((entry) => {
        batch.delete(doc(db, "timetable", entry.id))
      })
      
      // Then add all new entries
      for (const entry of timetable) {
        const newEntryRef = doc(collection(db, "timetable"))
        batch.set(newEntryRef, {
          course_id: entry.course_id,
          program_id: entry.program_id,
          lecturer_id: entry.lecturer_id,
          room_id: entry.room_id,
          day: entry.day,
          start_time: entry.start_time,
          end_time: entry.end_time,
          created_at: serverTimestamp(),
        })
      }
      
      await batch.commit()
      
      Alert.alert(
        "Success", 
        "Timetable saved successfully! Would you like to view it now?",
        [
          { text: "No", style: "cancel" },
          { 
            text: "Yes", 
            onPress: () => {
              // Navigate to the timetable screen
              navigation.navigate("Timetable", { 
                userRole: "admin", 
                refresh: true 
              })
            }
          }
        ]
      )
    } catch (error) {
      console.error("Error saving timetable:", error)
      Alert.alert("Error", "Failed to save timetable: " + error.message)
    } finally {
      setLoading(false)
    }
  }

  const resolveConflict = (conflict, index) => {
    // This would typically open a modal to manually resolve the conflict
    // For now, we'll just remove it from the list
    const updatedConflicts = [...conflicts]
    updatedConflicts.splice(index, 1)
    setConflicts(updatedConflicts)
    
    Alert.alert(
      "Conflict Resolution",
      "In a full implementation, this would open a dialog to manually resolve the conflict. For now, the conflict has been acknowledged."
    )
  }

  const renderProgramItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.programItem,
        selectedProgram?.id === item.id && styles.selectedProgramItem,
      ]}
      onPress={() => handleProgramSelect(item)}
    >
      <Text style={[
        styles.programName,
        selectedProgram?.id === item.id && styles.selectedProgramName,
      ]}>
        {item.name}
      </Text>
      <Text style={styles.programDetails}>
        {item.code} • {item.years} years • {item.semesters_per_year} semesters/year
      </Text>
    </TouchableOpacity>
  )

  const renderCourseItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.courseItem,
        item.selected && styles.selectedCourseItem,
      ]}
      onPress={() => toggleCourseSelection(item.id)}
    >
      <View style={styles.courseCheckbox}>
        {item.selected ? (
          <Ionicons name="checkbox" size={24} color="#0066cc" />
        ) : (
          <Ionicons name="square-outline" size={24} color="#666666" />
        )}
      </View>
      <View style={styles.courseInfo}>
        <Text style={styles.courseName}>{item.name}</Text>
        <Text style={styles.courseDetails}>
          {item.code} • {item.credit_hours || 3} credits • Year {item.year || 1}, Semester {item.semester || 1}
        </Text>
      </View>
    </TouchableOpacity>
  )

  const renderConflictItem = ({ item, index }) => (
    <Card style={styles.conflictCard}>
      <Card.Content>
        <View style={styles.conflictHeader}>
          <Ionicons name="alert-circle" size={24} color="#cc0000" style={styles.conflictIcon} />
          <Text style={styles.conflictType}>
            {item.type === "overlap" ? "Time Overlap" : item.type === "incomplete" ? "Incomplete Scheduling" : "Scheduling Issue"}
          </Text>
        </View>
        <Text style={styles.conflictMessage}>{item.message}</Text>
        <TouchableOpacity
          style={styles.resolveButton}
          onPress={() => resolveConflict(item, index)}
        >
          <Text style={styles.resolveButtonText}>Resolve Manually</Text>
        </TouchableOpacity>
      </Card.Content>
    </Card>
  )

  const renderTimetableByDay = () => {
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
    if (settings.allowWeekends) {
      days.push("Saturday", "Sunday")
    }
    
    return days.map((day) => {
      const dayEntries = timetable.filter((entry) => entry.day === day)
      
      if (dayEntries.length === 0) return null
      
      // Sort by start time
      dayEntries.sort((a, b) => {
        return a.start_time.localeCompare(b.start_time)
      })
      
      return (
        <View key={day} style={styles.dayContainer}>
          <Text style={styles.dayHeader}>{day}</Text>
          {dayEntries.map((entry) => (
            <Card key={entry.id} style={styles.timetableCard}>
              <Card.Content>
                <View style={styles.timetableTime}>
                  <Ionicons name="time-outline" size={16} color="#0066cc" />
                  <Text style={styles.timeText}>
                    {entry.start_time} - {entry.end_time}
                  </Text>
                </View>
                <Text style={styles.courseTitle}>{entry.course_name}</Text>
                <View style={styles.timetableDetails}>
                  <View style={styles.detailItem}>
                    <Ionicons name="person-outline" size={14} color="#666666" />
                    <Text style={styles.detailText}>{entry.lecturer_name}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Ionicons name="business-outline" size={14} color="#666666" />
                    <Text style={styles.detailText}>{entry.room_name}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Ionicons name="school-outline" size={14} color="#666666" />
                    <Text style={styles.detailText}>
                      Year {entry.year}, Semester {entry.semester}
                    </Text>
                  </View>
                </View>
              </Card.Content>
            </Card>
          ))}
        </View>
      )
    })
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0066cc" />
        <Text style={styles.loadingText}>Loading programs...</Text>
      </View>
    )
  }
 
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Timetable Generator</Text>
      </View>
      
      <View style={styles.content}>
        {/* Program Selection */}
        <View style={styles.programsContainer}>
          <Text style={styles.sectionTitle}>Select Program</Text>
          <FlatList
            data={programs}
            renderItem={renderProgramItem}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.programsList}
          />
        </View>
        
        {selectedProgram ? (
          <>
            {/* Tabs */}
            <View style={styles.tabsContainer}>
              <TouchableOpacity
                style={[styles.tab, activeTab === "settings" && styles.activeTab]}
                onPress={() => setActiveTab("settings")}
              >
                <Ionicons
                  name="settings-outline"
                  size={20}
                  color={activeTab === "settings" ? "#0066cc" : "#666666"}
                />
                <Text
                  style={[
                    styles.tabText,
                    activeTab === "settings" && styles.activeTabText,
                  ]}
                >
                  Settings
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.tab, activeTab === "conflicts" && styles.activeTab]}
                onPress={() => setActiveTab("conflicts")}
              >
                <Ionicons
                  name="alert-circle-outline"
                  size={20}
                  color={activeTab === "conflicts" ? "#0066cc" : "#666666"}
                />
                <Text
                  style={[
                    styles.tabText,
                    activeTab === "conflicts" && styles.activeTabText,
                  ]}
                >
                  Conflicts {conflicts.length > 0 && `(${conflicts.length})`}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.tab, activeTab === "preview" && styles.activeTab]}
                onPress={() => setActiveTab("preview")}
                disabled={!showTimetable}
              >
                <Ionicons
                  name="calendar-outline"
                  size={20}
                  color={
                    activeTab === "preview"
                      ? "#0066cc"
                      : !showTimetable
                      ? "#cccccc"
                      : "#666666"
                  }
                />
                <Text
                  style={[
                    styles.tabText,
                    activeTab === "preview" && styles.activeTabText,
                    !showTimetable && styles.disabledTabText,
                  ]}
                >
                  Preview
                </Text>
              </TouchableOpacity>
            </View>
            
            {/* Tab Content */}
            <ScrollView style={styles.tabContent}>
              {activeTab === "settings" && (
                <View>
                  {/* Course Selection */}
                  <View style={styles.coursesContainer}>
                    <Text style={styles.sectionTitle}>Courses to Include</Text>
                    {courses.length > 0 ? (
                      <FlatList
                        data={courses}
                        renderItem={renderCourseItem}
                        keyExtractor={(item) => item.id}
                        scrollEnabled={false}
                        nestedScrollEnabled={true}
                      />
                    ) : (
                      <Text style={styles.noCourses}>
                        No courses found for this program. Please add courses first.
                      </Text>
                    )}
                  </View>
                  
                  {/* Generator Settings */}
                  <View style={styles.settingsContainer}>
                    <Text style={styles.sectionTitle}>Generation Settings</Text>
                    
                    <View style={styles.settingItem}>
                      <Text style={styles.settingLabel}>Prioritize Room Size</Text>
                      <Switch
                        value={settings.prioritizeRoomSize}
                        onValueChange={(value) => updateSetting("prioritizeRoomSize", value)}
                        trackColor={{ false: "#cccccc", true: "#0066cc" }}
                      />
                    </View>
                    
                    <View style={styles.settingItem}>
                      <Text style={styles.settingLabel}>Avoid Back-to-Back Classes for Lecturers</Text>
                      <Switch
                        value={settings.avoidBackToBack}
                        onValueChange={(value) => updateSetting("avoidBackToBack", value)}
                        trackColor={{ false: "#cccccc", true: "#0066cc" }}
                      />
                    </View>
                    
                    <View style={styles.settingItem}>
                      <Text style={styles.settingLabel}>Balance Lecturer Workload</Text>
                      <Switch
                        value={settings.balanceLecturerLoad}
                        onValueChange={(value) => updateSetting("balanceLecturerLoad", value)}
                        trackColor={{ false: "#cccccc", true: "#0066cc" }}
                      />
                    </View>
                    
                    <View style={styles.settingItem}>
                      <Text style={styles.settingLabel}>Spread Courses Across Days</Text>
                      <Switch
                        value={settings.spreadCoursesAcrossDays}
                        onValueChange={(value) => updateSetting("spreadCoursesAcrossDays", value)}
                        trackColor={{ false: "#cccccc", true: "#0066cc" }}
                      />
                    </View>
                    
                    <View style={styles.settingItem}>
                      <Text style={styles.settingLabel}>Respect Credit Hours Exactly</Text>
                      <Switch
                        value={settings.respectCreditHours}
                        onValueChange={(value) => updateSetting("respectCreditHours", value)}
                        trackColor={{ false: "#cccccc", true: "#0066cc" }}
                      />
                    </View>
                    
                    <View style={styles.settingItem}>
                      <Text style={styles.settingLabel}>Allow Weekend Classes</Text>
                      <Switch
                        value={settings.allowWeekends}
                        onValueChange={(value) => updateSetting("allowWeekends", value)}
                        trackColor={{ false: "#cccccc", true: "#0066cc" }}
                      />
                    </View>
                    
                    <View style={styles.settingItem}>
                      <Text style={styles.settingLabel}>Maximum Daily Hours</Text>
                      <TextInput
                        style={styles.numberInput}
                        value={settings.maxDailyHours.toString()}
                        onChangeText={(value) => {
                          const numValue = parseInt(value) || 0
                          updateSetting("maxDailyHours", Math.min(Math.max(numValue, 0), 12))
                        }}
                        keyboardType="number-pad"
                      />
                    </View>
                    
                    <View style={styles.settingItem}>
                      <Text style={styles.settingLabel}>Max Sessions Per Day Per Course</Text>
                      <TextInput
                        style={styles.numberInput}
                        value={settings.maxSessionsPerDay.toString()}
                        onChangeText={(value) => {
                          const numValue = parseInt(value) || 0
                          updateSetting("maxSessionsPerDay", Math.min(Math.max(numValue, 1), 3))
                        }}
                        keyboardType="number-pad"
                      />
                    </View>
                    
                    <View style={styles.settingItem}>
                      <Text style={styles.settingLabel}>Preferred Start Time</Text>
                      <TextInput
                        style={styles.timeInput}
                        value={settings.preferredStartTime}
                        onChangeText={(value) => updateSetting("preferredStartTime", value)}
                        placeholder="HH:MM"
                      />
                    </View>
                    
                    <View style={styles.settingItem}>
                      <Text style={styles.settingLabel}>Preferred End Time</Text>
                      <TextInput
                        style={styles.timeInput}
                        value={settings.preferredEndTime}
                        onChangeText={(value) => updateSetting("preferredEndTime", value)}
                        placeholder="HH:MM"
                      />
                    </View>
                  </View>
                  
                  <TouchableOpacity
                    style={styles.generateButton}
                    onPress={generateTimetable}
                    disabled={isGenerating}
                  >
                    {isGenerating ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text style={styles.generateButtonText}>Generate Timetable</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
              
              {activeTab === "conflicts" && (
                <View>
                  {isGenerating ? (
                    <View style={styles.generatingContainer}>
                      <ActivityIndicator size="large" color="#0066cc" />
                      <Text style={styles.generatingText}>{generationStep}</Text>
                      <View style={styles.progressContainer}>
                        <View
                          style={[
                            styles.progressBar,
                            { width: `${generationProgress}%` },
                          ]}
                        />
                      </View>
                      <Text style={styles.progressText}>{generationProgress}%</Text>
                    </View>
                  ) : conflicts.length > 0 ? (
                    <View>
                      <Text style={styles.conflictsTitle}>
                        {conflicts.length} Conflicts Detected
                      </Text>
                      <Text style={styles.conflictsSubtitle}>
                        These conflicts need to be resolved before the timetable can be finalized
                      </Text>
                      <FlatList
                        data={conflicts}
                        renderItem={renderConflictItem}
                        keyExtractor={(item, index) => `conflict-${index}`}
                        scrollEnabled={false}
                        nestedScrollEnabled={true}
                      />
                      
                      {timetable.length > 0 && (
                        <TouchableOpacity
                          style={styles.previewButton}
                          onPress={() => {
                            setShowTimetable(true)
                            setActiveTab("preview")
                          }}
                        >
                          <Text style={styles.previewButtonText}>
                            Preview Current Timetable
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ) : (
                    <View style={styles.noConflictsContainer}>
                      <Ionicons name="checkmark-circle" size={64} color="#4CAF50" />
                      <Text style={styles.noConflictsText}>No Conflicts Detected</Text>
                      <Text style={styles.noConflictsSubtext}>
                        Your timetable has been generated successfully
                      </Text>
                      
                      <TouchableOpacity
                        style={styles.previewButton}
                        onPress={() => {
                          setShowTimetable(true)
                          setActiveTab("preview")
                        }}
                      >
                        <Text style={styles.previewButtonText}>
                          View Generated Timetable
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}
              
              {activeTab === "preview" && showTimetable && (
                <View>
                  <View style={styles.previewHeader}>
                    <Text style={styles.previewTitle}>
                      {selectedProgram.name} Timetable
                    </Text>
                    <TouchableOpacity
                      style={styles.saveButton}
                      onPress={saveTimetable}
                      disabled={loading}
                    >
                      {loading ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                      ) : (
                        <Text style={styles.saveButtonText}>Save Timetable</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                  
                  {renderTimetableByDay()}
                </View>
              )}
            </ScrollView>
          </>
        ) : (
          <View style={styles.noProgramContainer}>
            <Ionicons name="calendar-outline" size={64} color="#cccccc" />
            <Text style={styles.noProgramText}>Select a Program</Text>
            <Text style={styles.noProgramSubtext}>
              Choose a program to generate a timetable
            </Text>
          </View>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    padding: 16,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333333",
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#666666",
  },
  programsContainer: {
    backgroundColor: "#ffffff",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333333",
    marginBottom: 12,
  },
  programsList: {
    paddingRight: 16,
  },
  programItem: {
    backgroundColor: "#f0f0f0",
    borderRadius: 8,
    padding: 12,
    marginRight: 12,
    minWidth: 150,
  },
  selectedProgramItem: {
    backgroundColor: "#e6f0ff",
    borderColor: "#0066cc",
    borderWidth: 1,
  },
  programName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333333",
    marginBottom: 4,
  },
  selectedProgramName: {
    color: "#0066cc",
  },
  programDetails: {
    fontSize: 12,
    color: "#666666",
  },
  noProgramContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  noProgramText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#666666",
    marginTop: 16,
  },
  noProgramSubtext: {
    fontSize: 14,
    color: "#999999",
    marginTop: 8,
    textAlign: "center",
  },
  tabsContainer: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: "#0066cc",
  },
  tabText: {
    fontSize: 14,
    color: "#666666",
    marginLeft: 4,
  },
  activeTabText: {
    color: "#0066cc",
    fontWeight: "bold",
  },
  disabledTabText: {
    color: "#cccccc",
  },
  tabContent: {
    flex: 1,
    padding: 16,
  },
  coursesContainer: {
    marginBottom: 24,
  },
  courseItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  selectedCourseItem: {
    borderColor: "#0066cc",
    backgroundColor: "#f5f9ff",
  },
  courseCheckbox: {
    marginRight: 12,
  },
  courseInfo: {
    flex: 1,
  },
  courseName: {
    fontSize: 16,
    fontWeight: "500",
    color: "#333333",
    marginBottom: 4,
  },
  courseDetails: {
    fontSize: 12,
    color: "#666666",
  },
  noCourses: {
    fontSize: 14,
    color: "#666666",
    fontStyle: "italic",
    textAlign: "center",
    marginTop: 16,
  },
  settingsContainer: {
    backgroundColor: "#ffffff",
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
  },
  settingItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  settingLabel: {
    fontSize: 14,
    color: "#333333",
    flex: 1,
    marginRight: 16,
  },
  numberInput: {
    backgroundColor: "#f5f5f5",
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    width: 60,
    textAlign: "center",
  },
  timeInput: {
    backgroundColor: "#f5f5f5",
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    width: 80,
    textAlign: "center",
  },
  generateButton: {
    backgroundColor: "#0066cc",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginBottom: 24,
  },
  generateButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "bold",
  },
  generatingContainer: {
    alignItems: "center",
    padding: 24,
    backgroundColor: "#ffffff",
    borderRadius: 8,
    marginBottom: 16,
  },
  generatingText: {
    fontSize: 16,
    color: "#333333",
    marginTop: 16,
    marginBottom: 24,
  },
  progressContainer: {
    width: "100%",
    height: 8,
    backgroundColor: "#f0f0f0",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    backgroundColor: "#0066cc",
  },
  progressText: {
    fontSize: 14,
    color: "#666666",
    marginTop: 8,
  },
  conflictsTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#cc0000",
    marginBottom: 8,
  },
  conflictsSubtitle: {
    fontSize: 14,
    color: "#666666",
    marginBottom: 16,
  },
  conflictCard: {
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#cc0000",
  },
  conflictHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  conflictIcon: {
    marginRight: 8,
  },
  conflictType: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#cc0000",
  },
  conflictMessage: {
    fontSize: 14,
    color: "#333333",
    marginBottom: 12,
  },
  resolveButton: {
    backgroundColor: "#f0f0f0",
    padding: 8,
    borderRadius: 4,
    alignItems: "center",
  },
  resolveButtonText: {
    color: "#0066cc",
    fontWeight: "500",
  },
  noConflictsContainer: {
    alignItems: "center",
    padding: 24,
    backgroundColor: "#ffffff",
    borderRadius: 8,
  },
  noConflictsText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#4CAF50",
    marginTop: 16,
  },
  noConflictsSubtext: {
    fontSize: 14,
    color: "#666666",
    marginTop: 8,
    marginBottom: 24,
    textAlign: "center",
  },
  previewButton: {
    backgroundColor: "#0066cc",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
    marginTop: 16,
  },
  previewButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "bold",
  },
  previewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333333",
  },
  saveButton: {
    backgroundColor: "#4CAF50",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  saveButtonText: {
    color: "#ffffff",
    fontWeight: "bold",
  },
  dayContainer: {
    marginBottom: 24,
  },
  dayHeader: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#0066cc",
    marginBottom: 8,
    backgroundColor: "#e6f0ff",
    padding: 8,
    borderRadius: 4,
  },
  timetableCard: {
    marginBottom: 8,
  },
  timetableTime: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  timeText: {
    fontSize: 14,
    color: "#0066cc",
    fontWeight: "500",
    marginLeft: 4,
  },
  courseTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333333",
    marginBottom: 8,
  },
  timetableDetails: {
    marginTop: 4,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  detailText: {
    fontSize: 14,
    color: "#666666",
    marginLeft: 4,
  },
})

export default GeneratorScreen