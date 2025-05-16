"use client"

import { useState, useEffect } from "react"
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Alert,
  Modal,
  ActivityIndicator,
  ScrollView,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { Card } from "react-native-paper"
import { db } from "../../firebaseConfig"
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
} from "firebase/firestore"

const CourseManagementScreen = () => {
  const [courses, setCourses] = useState([])
  const [programs, setPrograms] = useState([])
  const [lecturers, setLecturers] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingCourse, setEditingCourse] = useState(null)
  const [searchQuery, setSearchQuery] = useState("")

  // Form state
  const [name, setName] = useState("")
  const [code, setCode] = useState("")
  const [creditHours, setCreditHours] = useState("3")
  const [programId, setProgramId] = useState("")
  const [lecturerId, setLecturerId] = useState("")
  const [year, setYear] = useState("1")
  const [semester, setSemester] = useState("1")
  const [expectedStudents, setExpectedStudents] = useState("30")

  useEffect(() => {
    fetchCourses()
    fetchPrograms()
    fetchLecturers()
  }, [])

  const fetchCourses = async () => {
    try {
      setLoading(true)

      const coursesRef = collection(db, "courses")
      const q = query(coursesRef, orderBy("name"))
      const querySnapshot = await getDocs(q)

      const coursesList = []

      for (const courseDoc of querySnapshot.docs) {
        const courseData = courseDoc.data()

        // Get program name
        let programName = ""
        if (courseData.program_id) {
          const programDoc = await getDoc(doc(db, "programs", courseData.program_id))
          if (programDoc.exists()) {
            programName = programDoc.data().name
          }
        }

        // Get lecturer name
        let lecturerName = ""
        if (courseData.lecturer_id) {
          const lecturerRef = doc(db, "lecturers", courseData.lecturer_id)
          const lecturerDoc = await getDoc(lecturerRef)
          
          if (lecturerDoc.exists()) {
            const lecturerData = lecturerDoc.data()
            
            if (lecturerData.user_id) {
              const userDoc = await getDoc(doc(db, "users", lecturerData.user_id))
              if (userDoc.exists()) {
                lecturerName = userDoc.data().name
              }
            }
          }
        }

        coursesList.push({
          id: courseDoc.id,
          ...courseData,
          programName,
          lecturerName,
        })
      }

      setCourses(coursesList)
    } catch (error) {
      console.error("Error fetching courses:", error)
      Alert.alert("Error", "Failed to load courses")
    } finally {
      setLoading(false)
    }
  }

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
    } catch (error) {
      console.error("Error fetching programs:", error)
    }
  }

  const fetchLecturers = async () => {
    try {
      const lecturersRef = collection(db, "users");
      const q = query(lecturersRef, where("role", "==", "lecturer")); // Fetch only lecturers
      const querySnapshot = await getDocs(q);
  
      const lecturersList = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(), // Includes name, email, and other fields
      }));
  
      setLecturers(lecturersList);
    } catch (error) {
      console.error("Error fetching lecturers:", error);
    }
  };
  

  const handleAddCourse = async () => {
    if (!validateForm()) return

    try {
      setLoading(true)

      // Add course to Firestore
      await addDoc(collection(db, "courses"), {
        name,
        code,
        credit_hours: parseInt(creditHours),
        program_id: programId,
        lecturer_id: lecturerId,
        year: parseInt(year),
        semester: parseInt(semester),
        expected_students: parseInt(expectedStudents),
        created_at: serverTimestamp(),
      })

      Alert.alert("Success", "Course added successfully")

      // Reset form and refresh courses
      resetForm()
      fetchCourses()
    } catch (error) {
      console.error("Error adding course:", error)
      Alert.alert("Error", "Failed to add course")
    } finally {
      setLoading(false)
      setModalVisible(false)
    }
  }

  const handleUpdateCourse = async () => {
    if (!validateForm()) return

    try {
      setLoading(true)

      // Update course in Firestore
      const courseRef = doc(db, "courses", editingCourse.id)
      await updateDoc(courseRef, {
        name,
        code,
        credit_hours: parseInt(creditHours),
        program_id: programId,
        lecturer_id: lecturerId,
        year: parseInt(year),
        semester: parseInt(semester),
        expected_students: parseInt(expectedStudents),
        updated_at: serverTimestamp(),
      })

      Alert.alert("Success", "Course updated successfully")

      // Reset form and refresh courses
      resetForm()
      fetchCourses()
    } catch (error) {
      console.error("Error updating course:", error)
      Alert.alert("Error", "Failed to update course")
    } finally {
      setLoading(false)
      setModalVisible(false)
    }
  }

  const handleDeleteCourse = async (courseId) => {
    Alert.alert(
      "Confirm Delete",
      "Are you sure you want to delete this course? This action cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setLoading(true)

              // Check if course is used in timetable
              const timetableRef = collection(db, "timetable")
              const timetableQuery = query(timetableRef, where("course_id", "==", courseId))
              const timetableSnapshot = await getDocs(timetableQuery)

              if (!timetableSnapshot.empty) {
                Alert.alert(
                  "Cannot Delete",
                  "This course is used in the timetable. Please remove all timetable entries for this course first."
                )
                setLoading(false)
                return
              }

              // Delete course
              await deleteDoc(doc(db, "courses", courseId))

              Alert.alert("Success", "Course deleted successfully")
              fetchCourses()
            } catch (error) {
              console.error("Error deleting course:", error)
              Alert.alert("Error", "Failed to delete course")
            } finally {
              setLoading(false)
            }
          },
        },
      ]
    )
  }

  const validateForm = () => {
    if (!name) {
      Alert.alert("Error", "Course name is required")
      return false
    }

    if (!code) {
      Alert.alert("Error", "Course code is required")
      return false
    }

    if (!programId) {
      Alert.alert("Error", "Please select a program")
      return false
    }

    return true
  }

  const resetForm = () => {
    setEditingCourse(null)
    setName("")
    setCode("")
    setCreditHours("3")
    setProgramId("")
    setLecturerId("")
    setYear("1")
    setSemester("1")
    setExpectedStudents("30")
  }

  const openEditModal = (course) => {
    setEditingCourse(course)
    setName(course.name)
    setCode(course.code)
    setCreditHours(course.credit_hours?.toString() || "3")
    setProgramId(course.program_id || "")
    setLecturerId(course.lecturer_id || "")
    setYear(course.year?.toString() || "1")
    setSemester(course.semester?.toString() || "1")
    setExpectedStudents(course.expected_students?.toString() || "30")
    setModalVisible(true)
  }

  const openAddModal = () => {
    resetForm()
    setModalVisible(true)
  }

  const filteredCourses = courses.filter(
    (course) =>
      course.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      course.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (course.programName && course.programName.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const renderCourseItem = ({ item }) => {
    return (
      <Card style={styles.courseCard}>
        <Card.Content>
          <View style={styles.courseHeader}>
            <View>
              <Text style={styles.courseName}>{item.name}</Text>
              <Text style={styles.courseCode}>{item.code}</Text>
            </View>
            <View style={styles.courseActions}>
              <TouchableOpacity style={styles.actionButton} onPress={() => openEditModal(item)}>
                <Ionicons name="create-outline" size={20} color="#0066cc" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionButton} onPress={() => handleDeleteCourse(item.id)}>
                <Ionicons name="trash-outline" size={20} color="#cc0000" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.courseDetails}>
            <View style={styles.detailItem}>
              <Ionicons name="school-outline" size={16} color="#666666" />
              <Text style={styles.detailText}>Program: {item.programName}</Text>
            </View>

            <View style={styles.detailItem}>
              <Ionicons name="calendar-outline" size={16} color="#666666" />
              <Text style={styles.detailText}>Year {item.year}, Semester {item.semester}</Text>
            </View>

            <View style={styles.detailItem}>
              <Ionicons name="time-outline" size={16} color="#666666" />
              <Text style={styles.detailText}>{item.credit_hours} Credit Hours</Text>
            </View>

            {item.lecturerName && (
              <View style={styles.detailItem}>
                <Ionicons name="person-outline" size={16} color="#666666" />
                <Text style={styles.detailText}>Lecturer: {item.lecturerName}</Text>
              </View>
            )}

            {item.expected_students && (
              <View style={styles.detailItem}>
                <Ionicons name="people-outline" size={16} color="#666666" />
                <Text style={styles.detailText}>Expected Students: {item.expected_students}</Text>
              </View>
            )}
          </View>
        </Card.Content>
      </Card>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Course Management</Text>
        <TouchableOpacity style={styles.addButton} onPress={openAddModal}>
          <Ionicons name="add" size={24} color="#ffffff" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#666666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search courses..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {loading && !modalVisible ? (
        <ActivityIndicator size="large" color="#0066cc" style={styles.loader} />
      ) : filteredCourses.length > 0 ? (
        <FlatList
          data={filteredCourses}
          renderItem={renderCourseItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="book-outline" size={64} color="#cccccc" />
          <Text style={styles.emptyText}>No courses found</Text>
          <Text style={styles.emptySubtext}>Add a course to get started</Text>
        </View>
      )}

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            {/* Add ScrollView here to make content scrollable */}
           <ScrollView contentContainerStyle={styles.modalScrollContent}>
            <Text style={styles.modalTitle}>{editingCourse ? "Edit Course" : "Add New Course"}</Text>

            <TextInput
              style={styles.input}
              placeholder="Course Name"
              value={name}
              onChangeText={setName}
            />

            <TextInput
              style={styles.input}
              placeholder="Course Code"
              value={code}
              onChangeText={setCode}
            />

            <View style={styles.formRow}>
              <View style={[styles.formColumn, { marginRight: 8 }]}>
                <Text style={styles.inputLabel}>Credit Hours</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Credit Hours"
                  value={creditHours}
                  onChangeText={setCreditHours}
                  keyboardType="number-pad"
                />
              </View>

              <View style={styles.formColumn}>
                <Text style={styles.inputLabel}>Expected Students</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Expected Students"
                  value={expectedStudents}
                  onChangeText={setExpectedStudents}
                  keyboardType="number-pad"
                />
              </View>
            </View>

            <View style={styles.formRow}>
              <View style={[styles.formColumn, { marginRight: 8 }]}>
                <Text style={styles.inputLabel}>Year</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Year"
                  value={year}
                  onChangeText={setYear}
                  keyboardType="number-pad"
                />
              </View>

              <View style={styles.formColumn}>
                <Text style={styles.inputLabel}>Semester</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Semester"
                  value={semester}
                  onChangeText={setSemester}
                  keyboardType="number-pad"
                />
              </View>
            </View>

            <Text style={styles.inputLabel}>Program</Text>
            <View style={styles.pickerContainer}>
              {programs.map((program) => (
                <TouchableOpacity
                  key={program.id}
                  style={[
                    styles.pickerOption,
                    programId === program.id && styles.pickerOptionSelected,
                  ]}
                  onPress={() => setProgramId(program.id)}
                >
                  <Text
                    style={[
                      styles.pickerOptionText,
                      programId === program.id && styles.pickerOptionTextSelected,
                    ]}
                  >
                    {program.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Lecturer (Optional)</Text>
            <View style={styles.pickerContainer}>
              <TouchableOpacity
                style={[
                  styles.pickerOption,
                  !lecturerId && styles.pickerOptionSelected,
                ]}
                onPress={() => setLecturerId("")}
              >
                <Text
                  style={[
                    styles.pickerOptionText,
                    !lecturerId && styles.pickerOptionTextSelected,
                  ]}
                >
                  None
                </Text>
              </TouchableOpacity>
              
              {lecturers.map((lecturer) => (
                <TouchableOpacity
                  key={lecturer.id}
                  style={[
                    styles.pickerOption,
                    lecturerId === lecturer.id && styles.pickerOptionSelected,
                  ]}
                  onPress={() => setLecturerId(lecturer.id)}
                >
                  <Text
                    style={[
                      styles.pickerOptionText,
                      lecturerId === lecturer.id && styles.pickerOptionTextSelected,
                    ]}
                  >
                    {lecturer.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={editingCourse ? handleUpdateCourse : handleAddCourse}
              >
                <Text style={styles.saveButtonText}>{editingCourse ? "Update" : "Add"}</Text>
              </TouchableOpacity>
            </View>
            
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
  addButton: {
    backgroundColor: "#0066cc",
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    margin: 16,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
  },
  loader: {
    marginTop: 32,
  },
  listContainer: {
    padding: 16,
  },
  courseCard: {
    marginBottom: 16,
    elevation: 2,
  },
  courseHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  courseName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333333",
    marginBottom: 4,
  },
  courseCode: {
    fontSize: 14,
    color: "#0066cc",
    fontWeight: "500",
  },
  courseActions: {
    flexDirection: "row",
  },
  actionButton: {
    padding: 8,
  },
  courseDetails: {
    marginTop: 8,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  detailText: {
    fontSize: 14,
    color: "#666666",
    marginLeft: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#666666",
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#999999",
    marginTop: 8,
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    width: "90%",
    maxHeight: "80%",
    backgroundColor: "#ffffff",
    borderRadius: 8,
    padding: 16,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333333",
    marginBottom: 16,
    textAlign: "center",
  },
  input: {
    height: 50,
    borderColor: "#cccccc",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    marginBottom: 16,
    fontSize: 16,
  },
  inputLabel: {
    fontSize: 14,
    color: "#666666",
    marginBottom: 8,
  },
  formRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  formColumn: {
    flex: 1,
  },
  pickerContainer: {
    marginBottom: 16,
  },
  pickerOption: {
    padding: 12,
    borderWidth: 1,
    borderColor: "#cccccc",
    borderRadius: 8,
    marginBottom: 8,
  },
  pickerOptionSelected: {
    borderColor: "#0066cc",
    backgroundColor: "#e6f0ff",
  },
  pickerOptionText: {
    fontSize: 16,
    color: "#333333",
  },
  pickerOptionTextSelected: {
    color: "#0066cc",
    fontWeight: "bold",
  },
  modalScrollContent: {
    paddingBottom: 20, // Add some padding at the bottom
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "#f0f0f0",
    marginRight: 8,
  },
  cancelButtonText: {
    color: "#333333",
    fontWeight: "bold",
  },
  saveButton: {
    backgroundColor: "#0066cc",
    marginLeft: 8,
  },
  saveButtonText: {
    color: "#ffffff",
    fontWeight: "bold",
  },
})

export default CourseManagementScreen