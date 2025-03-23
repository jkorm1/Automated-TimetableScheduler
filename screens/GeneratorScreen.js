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

const GeneratorScreen = () => {
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

  const fetchLecturers = async () => {
    try {
      const lecturersRef = collection(db, "lecturers")
      const lecturersSnapshot = await getDocs(lecturersRef)
      
      const lecturersList = []
      
      for (const lecturerDoc of lecturersSnapshot.docs) {
        const lecturerData = lecturerDoc.data()
        
        // Get user data for lecturer
        if (lecturerData.user_id) {
          const userDoc = await getDoc(doc(db, "users", lecturerData.user_id))
          
          if (userDoc.exists()) {
            const userData = userDoc.data()
            
            lecturersList.push({
              id: lecturerDoc.id,
              ...lecturerData,
              name: userData.name,
              email: userData.email,
            })
          }
        }
      }
      
      setLecturers(lecturersList)
    } catch (error) {
      console.error("Error fetching lecturers:", error)
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
        })
      })
      
      setRooms(roomsList)
    } catch (error) {
      console.error("Error fetching rooms:", error)
    }
  }

  const fetchCourses = async (programId) => {
    try {
      const coursesRef = collection(db, "courses")
      const q = query(coursesRef, where("program_id", "==", programId))
      const coursesSnapshot = await getDocs(q)
      
      const coursesList = []
      coursesSnapshot.forEach((doc) => {
        coursesList.push({
          id: doc.id,
          ...doc.data(),
          selected: true, // Default all courses to be included
        })
      })
      
      setCourses(coursesList)
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
    
    return true
  }

  const generateTimetable = async () => {
    if (!validateSettings()) return
    
    try {
      setIsGenerating(true)
      setGenerationProgress(0)
      setGenerationStep("Initializing timetable generation...")
      setActiveTab("conflicts")
      setConflicts([])
      setTimetable([])
      
      // Step 1: Get selected courses
      const selectedCourses = courses.filter(course => course.selected)
      setGenerationProgress(10)
      setGenerationStep("Analyzing course requirements...")
      
      // Step 2: Create time slots
      const days = settings.allowWeekends 
        ? ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] 
        : ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
      
      const startHour = parseInt(settings.preferredStartTime.split(":")[0])
      const endHour = parseInt(settings.preferredEndTime.split(":")[0])
      
      let timeSlots = []
      for (const day of days) {
        for (let hour = startHour; hour < endHour; hour++) {
          timeSlots.push({
            day,
            startTime: `${hour.toString().padStart(2, "0")}:00`,
            endTime: `${(hour + 1).toString().padStart(2, "0")}:00`,
          })
        }
      }
      
      setGenerationProgress(20)
      setGenerationStep("Allocating rooms and time slots...")
      
      // Step 3: Generate initial timetable
      let generatedTimetable = []
      let currentConflicts = []
      
      // Sort rooms by capacity if prioritizing room size
      const sortedRooms = [...rooms]
      if (settings.prioritizeRoomSize) {
        sortedRooms.sort((a, b) => (b.capacity || 0) - (a.capacity || 0))
      }
      
      // Track lecturer and room assignments
      const lecturerAssignments = {}
      const roomAssignments = {}
      
      // Initialize tracking objects
      lecturers.forEach(lecturer => {
        lecturerAssignments[lecturer.id] = {
          dailyHours: { Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0 },
          lastTimeSlot: null,
        }
        if (settings.allowWeekends) {
          lecturerAssignments[lecturer.id].dailyHours.Saturday = 0
          lecturerAssignments[lecturer.id].dailyHours.Sunday = 0
        }
      })
      
      timeSlots.forEach(slot => {
        roomAssignments[`${slot.day}-${slot.startTime}`] = new Set()
      })
      
      setGenerationProgress(30)
      
      // Assign courses to time slots and rooms
      for (const course of selectedCourses) {
        setGenerationStep(`Scheduling ${course.name || 'course'}...`)
        
        // Get course details
        const creditHours = course.credit_hours || 3
        const weeklyHours = creditHours
        const sessionsPerWeek = Math.ceil(weeklyHours / 2) // Assume 2-hour sessions
        
        // Get assigned lecturer
        const lecturerId = course.lecturer_id
        let lecturer = null
        if (lecturerId) {
          lecturer = lecturers.find(l => l.id === lecturerId)
        } else {
          // Assign a lecturer with the least load if none assigned
          if (settings.balanceLecturerLoad) {
            lecturer = lecturers.reduce((leastBusy, current) => {
              const leastBusyHours = Object.values(lecturerAssignments[leastBusy.id].dailyHours).reduce((a, b) => a + b, 0)
              const currentHours = Object.values(lecturerAssignments[current.id].dailyHours).reduce((a, b) => a + b, 0)
              return currentHours < leastBusyHours ? current : leastBusy
            }, lecturers[0])
          } else {
            lecturer = lecturers[0]
          }
        }
        
        // Schedule each session
        for (let session = 0; session < sessionsPerWeek; session++) {
          let scheduled = false
          
          // Try to find a suitable time slot and room
          for (const timeSlot of timeSlots) {
            // Skip if lecturer already has max daily hours
            if (lecturerAssignments[lecturer.id].dailyHours[timeSlot.day] >= settings.maxDailyHours) {
              continue
            }
            
            // Skip if avoiding back-to-back and lecturer just had a class
            if (settings.avoidBackToBack && 
                lecturerAssignments[lecturer.id].lastTimeSlot && 
                lecturerAssignments[lecturer.id].lastTimeSlot.day === timeSlot.day &&
                lecturerAssignments[lecturer.id].lastTimeSlot.endTime === timeSlot.startTime) {
              continue
            }
            
            // Find a suitable room
            for (const room of sortedRooms) {
              // Skip if room is too small
              if (settings.prioritizeRoomSize && room.capacity < (course.expected_students || 0)) {
                continue
              }
              
              // Check if room is available at this time
              const timeRoomKey = `${timeSlot.day}-${timeSlot.startTime}`
              if (!roomAssignments[timeRoomKey].has(room.id)) {
                // Room is available, schedule the session
                const timetableEntry = {
                  id: `${course.id}-${session}`,
                  course_id: course.id,
                  course_name: course.name,
                  course_code: course.code,
                  lecturer_id: lecturer.id,
                  lecturer_name: lecturer.name,
                  room_id: room.id,
                  room_name: room.name,
                  day: timeSlot.day,
                  start_time: timeSlot.startTime,
                  end_time: timeSlot.endTime,
                  program_id: selectedProgram.id,
                  program_name: selectedProgram.name,
                  year: course.year || 1,
                  semester: course.semester || 1,
                }
                
                generatedTimetable.push(timetableEntry)
                
                // Mark room as occupied for this time slot
                roomAssignments[timeRoomKey].add(room.id)
                
                // Update lecturer assignments
                lecturerAssignments[lecturer.id].dailyHours[timeSlot.day] += 1
                lecturerAssignments[lecturer.id].lastTimeSlot = timeSlot
                
                scheduled = true
                break
              }
            }
            
            if (scheduled) break
          }
          
          // If couldn't schedule, add to conflicts
          if (!scheduled) {
            currentConflicts.push({
              type: "scheduling",
              course_id: course.id,
              course_name: course.name,
              lecturer_id: lecturer.id,
              lecturer_name: lecturer.name,
              message: `Could not find a suitable time slot and room for ${course.name} (Session ${session + 1})`,
            })
          }
        }
        
        setGenerationProgress(30 + (60 * (selectedCourses.indexOf(course) + 1) / selectedCourses.length))
      }
      
      setGenerationProgress(90)
      setGenerationStep("Checking for conflicts...")
      
      // Check for any overlapping classes for the same year/semester
      const yearSemesterGroups = {}
      
      generatedTimetable.forEach(entry => {
        const key = `${entry.year}-${entry.semester}`
        if (!yearSemesterGroups[key]) {
          yearSemesterGroups[key] = []
        }
        yearSemesterGroups[key].push(entry)
      })
      
      // Check each group for time conflicts
      Object.values(yearSemesterGroups).forEach(group => {
        const timeSlotMap = {}
        
        group.forEach(entry => {
          const key = `${entry.day}-${entry.start_time}`
          
          if (timeSlotMap[key]) {
            currentConflicts.push({
              type: "overlap",
              entries: [timeSlotMap[key], entry],
              message: `Time conflict: ${timeSlotMap[key].course_name} and ${entry.course_name} are scheduled at the same time (${entry.day} ${entry.start_time}) for Year ${entry.year}, Semester ${entry.semester}`,
            })
          } else {
            timeSlotMap[key] = entry
          }
        })
      })
      
      setGenerationProgress(100)
      setGenerationStep("Timetable generation complete!")
      setTimetable(generatedTimetable)
      setConflicts(currentConflicts)
      
      if (currentConflicts.length === 0) {
        setActiveTab("preview")
        setShowTimetable(true)
      }
      
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
          ...entry,
          created_at: serverTimestamp(),
        })
      }
      
      await batch.commit()
      
      Alert.alert("Success", "Timetable saved successfully")
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
            {item.type === "overlap" ? "Time Overlap" : "Scheduling Issue"}
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