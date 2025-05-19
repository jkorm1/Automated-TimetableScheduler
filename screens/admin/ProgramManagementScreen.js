"use client"

import { useState, useEffect } from "react"
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  ActivityIndicator,
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
  orderBy,
  serverTimestamp,
} from "firebase/firestore"

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

const ProgramManagementScreen = () => {
  const [programs, setPrograms] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingProgram, setEditingProgram] = useState(null)
  const [searchQuery, setSearchQuery] = useState("")

  // Form state
  const [name, setName] = useState("")
  const [code, setCode] = useState("")
  const [years, setYears] = useState("4")
  const [semestersPerYear, setSemestersPerYear] = useState("2")

  useEffect(() => {
    fetchPrograms()
  }, [])

  const fetchPrograms = async () => {
    try {
      setLoading(true)

      const programsRef = collection(db, "programs")
      const q = query(programsRef, orderBy("name"))
      const querySnapshot = await getDocs(q)

      const programsList = []
      querySnapshot.forEach((doc) => {
        programsList.push({
          id: doc.id,
          ...doc.data(),
        })
      })

      setPrograms(programsList)
    } catch (error) {
      console.error("Error fetching programs:", error)
      Alert.alert("Error", "Failed to load programs")
    } finally {
      setLoading(false)
    }
  }

  const handleAddProgram = async () => {
    if (!name || !code || !years || !semestersPerYear) {
      Alert.alert("Error", "Please fill in all required fields")
      return
    }

    try {
      setLoading(true)

      // Add program to Firestore
      await addDoc(collection(db, "programs"), {
        name,
        code,
        years: parseInt(years),
        semesters_per_year: parseInt(semestersPerYear),
        created_at: serverTimestamp(),
      })

      Alert.alert("Success", "Program added successfully")

      // Reset form and refresh programs
      resetForm()
      fetchPrograms()
    } catch (error) {
      console.error("Error adding program:", error)
      Alert.alert("Error", "Failed to add program")
    } finally {
      setLoading(false)
      setModalVisible(false)
    }
  }

  const handleUpdateProgram = async () => {
    if (!name || !code || !years || !semestersPerYear) {
      Alert.alert("Error", "Please fill in all required fields")
      return
    }

    try {
      setLoading(true)

      // Update program in Firestore
      const programRef = doc(db, "programs", editingProgram.id)
      await updateDoc(programRef, {
        name,
        code,
        years: parseInt(years),
        semesters_per_year: parseInt(semestersPerYear),
        updated_at: serverTimestamp(),
      })

      Alert.alert("Success", "Program updated successfully")

      // Reset form and refresh programs
      resetForm()
      fetchPrograms()
    } catch (error) {
      console.error("Error updating program:", error)
      Alert.alert("Error", "Failed to update program")
    } finally {
      setLoading(false)
      setModalVisible(false)
    }
  }

  const handleDeleteProgram = async (programId) => {
    Alert.alert(
      "Confirm Delete",
      "Are you sure you want to delete this program? This action cannot be undone.",
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

              // Check if program is used in courses
              const coursesRef = collection(db, "courses")
              const coursesQuery = query(coursesRef, where("program_id", "==", programId))
              const coursesSnapshot = await getDocs(coursesQuery)

              if (!coursesSnapshot.empty) {
                Alert.alert(
                  "Cannot Delete",
                  "This program is used in courses. Please remove all courses for this program first."
                )
                setLoading(false)
                return
              }

              // Delete program
              await deleteDoc(doc(db, "programs", programId))

              Alert.alert("Success", "Program deleted successfully")
              fetchPrograms()
            } catch (error) {
              console.error("Error deleting program:", error)
              Alert.alert("Error", "Failed to delete program")
            } finally {
              setLoading(false)
            }
          },
        },
      ]
    )
  }

  const resetForm = () => {
    setEditingProgram(null)
    setName("")
    setCode("")
    setYears("4")
    setSemestersPerYear("2")
  }

  const openEditModal = (program) => {
    setEditingProgram(program)
    setName(program.name)
    setCode(program.code)
    setYears(program.years?.toString() || "4")
    setSemestersPerYear(program.semesters_per_year?.toString() || "2")
    setModalVisible(true)
  }

  const openAddModal = () => {
    resetForm()
    setModalVisible(true)
  }

  const filteredPrograms = programs.filter(
    (program) =>
      program.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      program.code.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const renderProgramItem = ({ item }) => {
    return (
      <Card style={styles.programCard}>
        <Card.Content>
          <View style={styles.programHeader}>
            <View>
              <Text style={styles.programName}>{item.name}</Text>
              <Text style={styles.programCode}>{item.code}</Text>
            </View>
            <View style={styles.programActions}>
              <TouchableOpacity style={styles.actionButton} onPress={() => openEditModal(item)}>
                <Ionicons name="create-outline" size={20} color="#0066cc" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionButton} onPress={() => handleDeleteProgram(item.id)}>
                <Ionicons name="trash-outline" size={20} color="#cc0000" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.programDetails}>
            <View style={styles.detailItem}>
              <Ionicons name="calendar-outline" size={16} color="#666666" />
              <Text style={styles.detailText}>{item.years} years</Text>
            </View>

            <View style={styles.detailItem}>
              <Ionicons name="school-outline" size={16} color="#666666" />
              <Text style={styles.detailText}>{item.semesters_per_year} semesters/year</Text>
            </View>
          </View>
        </Card.Content>
      </Card>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Program Management</Text>
        <TouchableOpacity style={styles.addButton} onPress={openAddModal}>
          <Ionicons name="add" size={24} color="#ffffff" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#666666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search programs..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {loading && !modalVisible ? (
        <ActivityIndicator size="large" color="#0066cc" style={styles.loader} />
      ) : filteredPrograms.length > 0 ? (
        <FlatList
          data={filteredPrograms}
          renderItem={renderProgramItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="school-outline" size={64} color="#cccccc" />
          <Text style={styles.emptyText}>No programs found</Text>
          <Text style={styles.emptySubtext}>Add a program to get started</Text>
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
            <Text style={styles.modalTitle}>{editingProgram ? "Edit Program" : "Add New Program"}</Text>

            <TextInput
              style={styles.input}
              placeholder="Program Name"
              value={name}
              onChangeText={setName}
            />

            <TextInput
              style={styles.input}
              placeholder="Program Code"
              value={code}
              onChangeText={setCode}
            />

            <TextInput
              style={styles.input}
              placeholder="Number of Years"
              value={years}
              onChangeText={setYears}
              keyboardType="number-pad"
            />

            <TextInput
              style={styles.input}
              placeholder="Semesters per Year"
              value={semestersPerYear}
              onChangeText={setSemestersPerYear}
              keyboardType="number-pad"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={editingProgram ? handleUpdateProgram : handleAddProgram}
              >
                <Text style={styles.saveButtonText}>{editingProgram ? "Update" : "Add"}</Text>
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
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: COLORS.primary,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: COLORS.secondary,
  },
  addButton: {
    backgroundColor: COLORS.secondary,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.cardBackground,
    margin: 16,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchIcon: {
    marginRight: 8,
    color: COLORS.primary,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
    color: COLORS.text,
  },
  loader: {
    marginTop: 32,
  },
  listContainer: {
    padding: 16,
  },
  programCard: {
    marginBottom: 16,
    elevation: 2,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  programHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  programName: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.text,
  },
  programCode: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: "500",
  },
  programActions: {
    flexDirection: "row",
  },
  actionButton: {
    padding: 8,
  },
  programDetails: {
    marginTop: 8,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  detailText: {
    fontSize: 14,
    color: COLORS.textLight,
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
    color: COLORS.textLight,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#999999",
    marginTop: 8,
    textAlign: "center",
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    width: "90%",
    backgroundColor: COLORS.cardBackground,
    borderRadius: 8,
    padding: 16,
    borderTopWidth: 4,
    borderTopColor: COLORS.primary,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: COLORS.primary,
    marginBottom: 16,
    textAlign: "center",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 8,
  },
  input: {
    height: 50,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    marginBottom: 16,
    fontSize: 16,
    backgroundColor: "#FFFFFF",
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
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
    color: COLORS.text,
    fontWeight: "bold",
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    marginLeft: 8,
  },
  saveButtonText: {
    color: COLORS.secondary,
    fontWeight: "bold",
  },
})
export default ProgramManagementScreen