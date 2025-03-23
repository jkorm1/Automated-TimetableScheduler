import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  ActivityIndicator,
  Alert,
  TextInput
} from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Card } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../firebaseConfig';
import { 
  collection, 
  getDocs, 
  query, 
  where, 
  doc, 
  getDoc,
  addDoc,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';
import * as Location from 'expo-location';

const Stack = createNativeStackNavigator();

const AttendanceScreen = ({ route }) => {
  const { userRole } = route.params;
  
  return (
    <Stack.Navigator>
      {userRole === 'lecturer' ? (
        <>
          <Stack.Screen 
            name="LecturerAttendance" 
            component={LecturerAttendanceScreen} 
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="TakeAttendance" 
            component={TakeAttendanceScreen} 
            options={{ title: 'Take Attendance' }}
          />
          <Stack.Screen 
            name="ViewAttendance" 
            component={ViewAttendanceScreen} 
            options={{ title: 'View Attendance' }}
          />
        </>
      ) : (
        <>
          <Stack.Screen 
            name="StudentAttendance" 
            component={StudentAttendanceScreen} 
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="Submit" 
            component={SubmitAttendanceScreen} 
            options={{ title: 'Submit Attendance' }}
          />
          <Stack.Screen 
            name="History" 
            component={AttendanceHistoryScreen} 
            options={{ title: 'Attendance History' }}
          />
        </>
      )}
    </Stack.Navigator>
  );
};

// Lecturer Screens
const LecturerAttendanceScreen = ({ navigation }) => {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchClasses();
  }, []);
  
  const fetchClasses = async () => {
    try {
      setLoading(true);
      const user = auth.currentUser;
      if (!user) return;
      
      // Get lecturer ID
      const lecturerRef = collection(db, "lecturers");
      const lecturerQuery = query(lecturerRef, where("user_id", "==", user.uid));
      const lecturerSnapshot = await getDocs(lecturerQuery);
      
      if (!lecturerSnapshot.empty) {
        const lecturerId = lecturerSnapshot.docs[0].id;
        
        // Get timetable entries for this lecturer
        const timetableRef = collection(db, "timetable");
        const timetableQuery = query(timetableRef, where("lecturer_id", "==", lecturerId));
        const timetableSnapshot = await getDocs(timetableQuery);
        
        const classesData = [];
        
        for (const doc of timetableSnapshot.docs) {
          const timetableData = doc.data();
          
          // Get course details
          const courseRef = collection(db, "courses");
          const courseQuery = query(courseRef, where("id", "==", timetableData.course_id));
          const courseSnapshot = await getDocs(courseQuery);
          
          // Get room details
          const roomRef = collection(db, "rooms");
          const roomQuery = query(roomRef, where("id", "==", timetableData.room_id));
          const roomSnapshot = await getDocs(roomQuery);
          
          if (!courseSnapshot.empty && !roomSnapshot.empty) {
            const courseData = courseSnapshot.docs[0].data();
            const roomData = roomSnapshot.docs[0].data();
            
            classesData.push({
              id: doc.id,
              course: courseData.name,
              courseId: courseData.id,
              room: roomData.name,
              roomId: roomData.id,
              day: timetableData.day,
              time: `${timetableData.start_time} - ${timetableData.end_time}`,
              students: courseData.enrolled_students || 0
            });
          }
        }
        
        setClasses(classesData);
      }
    } catch (error) {
      console.error("Error fetching classes:", error);
      Alert.alert("Error", "Failed to load classes. Please try again.");
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0066cc" />
      </View>
    );
  }
  
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Attendance Management</Text>
        <Text style={styles.headerSubtitle}>Take and view attendance for your classes</Text>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Today's Classes</Text>
        {classes.length > 0 ? (
          classes.map(cls => (
            <Card key={cls.id} style={styles.card}>
              <Card.Content>
                <Text style={styles.cardTitle}>{cls.course}</Text>
                <Text style={styles.cardSubtitle}>{cls.room}</Text>
                <Text style={styles.cardSubtitle}>{cls.day}, {cls.time}</Text>
                
                <View style={styles.cardActions}>
                  <TouchableOpacity 
                    style={styles.actionButton}
                    onPress={() => navigation.navigate('TakeAttendance', { classId: cls.id })}
                  >
                    <Text style={styles.actionButtonText}>Take Attendance</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[styles.actionButton, styles.secondaryButton]}
                    onPress={() => navigation.navigate('ViewAttendance', { classId: cls.id })}
                  >
                    <Text style={styles.secondaryButtonText}>View Records</Text>
                  </TouchableOpacity>
                </View>
              </Card.Content>
            </Card>
          ))
        ) : (
          <Text style={styles.emptyText}>No classes found.</Text>
        )}
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Attendance Statistics</Text>
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>85%</Text>
                <Text style={styles.statLabel}>Average Attendance</Text>
              </View>
              
              <View style={styles.statItem}>
                <Text style={styles.statValue}>12</Text>
                <Text style={styles.statLabel}>Sessions Recorded</Text>
              </View>
              
              <View style={styles.statItem}>
                <Text style={styles.statValue}>3</Text>
                <Text style={styles.statLabel}>Pending Sessions</Text>
              </View>
            </View>
          </Card.Content>
        </Card>
      </View>
    </ScrollView>
  );
};

const TakeAttendanceScreen = ({ route, navigation }) => {
  const { classId } = route.params;
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [attendanceCode, setAttendanceCode] = useState('');
  const [location, setLocation] = useState(null);
  
  useEffect(() => {
    fetchStudents();
    generateAttendanceCode();
    getLocation();
  }, []);
  
  const fetchStudents = async () => {
    try {
      setLoading(true);
      
      // Get class details
      const classRef = doc(db, "timetable", classId);
      const classDoc = await getDoc(classRef);
      
      if (classDoc.exists()) {
        const classData = classDoc.data();
        
        // Get course details
        const courseRef = collection(db, "courses");
        const courseQuery = query(courseRef, where("id", "==", classData.course_id));
        const courseSnapshot = await getDocs(courseQuery);
        
        if (!courseSnapshot.empty) {
          const courseData = courseSnapshot.docs[0].data();
          
          // Get students enrolled in this course
          const studentRef = collection(db, "students");
          const studentQuery = query(studentRef, where("program_id", "==", classData.program_id));
          const studentSnapshot = await getDocs(studentQuery);
          
          const studentsData = [];
          
          for (const doc of studentSnapshot.docs) {
            const studentData = doc.data();
            
            // Get student user details
            const userRef = collection(db, "users");
            const userQuery = query(userRef, where("id", "==", studentData.user_id));
            const userSnapshot = await getDocs(userQuery);
            
            if (!userSnapshot.empty) {
              const userData = userSnapshot.docs[0].data();
              
              studentsData.push({
                id: doc.id,
                name: userData.name,
                email: userData.email,
                present: false
              });
            }
          }
          
          setStudents(studentsData);
        }
      }
    } catch (error) {
      console.error("Error fetching students:", error);
      Alert.alert("Error", "Failed to load students. Please try again.");
    } finally {
      setLoading(false);
    }
  };
  
  const generateAttendanceCode = () => {
    // Generate a random 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setAttendanceCode(code);
  };
  
  const getLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required for attendance verification.');
        return;
      }
      
      const location = await Location.getCurrentPositionAsync({});
      setLocation(location);
    } catch (error) {
      console.error("Error getting location:", error);
      Alert.alert("Error", "Failed to get location. Please try again.");
    }
  };
  
  const markAttendance = (studentId, present) => {
    setStudents(students.map(student => 
      student.id === studentId ? { ...student, present } : student
    ));
  };
  
  const submitAttendance = async () => {
    try {
      // Create attendance record
      const attendanceRef = collection(db, "attendance");
      await addDoc(attendanceRef, {
        class_id: classId,
        date: new Date().toISOString(),
        code: attendanceCode,
        location: location ? {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude
        } : null,
        students: students.map(student => ({
          student_id: student.id,
          present: student.present
        })),
        created_at: serverTimestamp()
      });
      
      Alert.alert(
        "Success", 
        "Attendance recorded successfully.",
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error("Error submitting attendance:", error);
      Alert.alert("Error", "Failed to submit attendance. Please try again.");
    }
  };
  
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0066cc" />
      </View>
    );
  }
  
  return (
    <ScrollView style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.cardTitle}>Attendance Code</Text>
          <View style={styles.codeContainer}>
            <Text style={styles.codeText}>{attendanceCode}</Text>
          </View>
          <Text style={styles.codeInstructions}>
            Share this code with students to verify their attendance.
          </Text>
        </Card.Content>
      </Card>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Student List</Text>
        {students.map(student => (
          <Card key={student.id} style={styles.card}>
            <Card.Content>
              <View style={styles.studentRow}>
                <View>
                  <Text style={styles.studentName}>{student.name}</Text>
                  <Text style={styles.studentEmail}>{student.email}</Text>
                </View>
                
                <View style={styles.attendanceToggle}>
                  <TouchableOpacity 
                    style={[
                      styles.toggleButton, 
                      student.present ? styles.toggleButtonActive : null
                    ]}
                    onPress={() => markAttendance(student.id, !student.present)}
                  >
                    {student.present ? (
                      <Ionicons name="checkmark" size={24} color="#ffffff" />
                    ) : (
                      <Text style={styles.toggleButtonText}>Mark</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </Card.Content>
          </Card>
        ))}
      </View>
      
      <TouchableOpacity 
        style={styles.submitButton}
        onPress={submitAttendance}
      >
        <Text style={styles.submitButtonText}>Submit Attendance</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const ViewAttendanceScreen = ({ route }) => {
  const { classId } = route.params;
  
  // Implement view attendance functionality
  
  return (
    <View style={styles.container}>
      <Text>View Attendance for Class: {classId}</Text>
    </View>
  );
};

// Student Screens
const StudentAttendanceScreen = ({ navigation }) => {
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchAttendanceRecords();
  }, []);
  
  const fetchAttendanceRecords = async () => {
    try {
      setLoading(true);
      const user = auth.currentUser;
      if (!user) return;
      
      // Get student ID
      const studentRef = collection(db, "students");
      const studentQuery = query(studentRef, where("user_id", "==", user.uid));
      const studentSnapshot = await getDocs(studentQuery);
      
      if (!studentSnapshot.empty) {
        const studentId = studentSnapshot.docs[0].id;
        
        // Get attendance records for this student
        const attendanceRef = collection(db, "attendance");
        const attendanceSnapshot = await getDocs(attendanceRef);
        
        const records = [];
        
        for (const doc of attendanceSnapshot.docs) {
          const attendanceData = doc.data();
          
          // Check if student is in this attendance record
          const studentRecord = attendanceData.students.find(s => s.student_id === studentId);
          
          if (studentRecord) {
            // Get class details
            const classRef = doc(db, "timetable", attendanceData.class_id);
            const classDoc = await getDoc(classRef);
            
            if (classDoc.exists()) {
              const classData = classDoc.data();
              
              // Get course details
              const courseRef = collection(db, "courses");
              const courseQuery = query(courseRef, where("id", "==", classData.course_id));
              const courseSnapshot = await getDocs(courseQuery);
              
              if (!courseSnapshot.empty) {
                const courseData = courseSnapshot.docs[0].data();
                
                records.push({
                  id: doc.id,
                  date: new Date(attendanceData.date),
                  course: courseData.name,
                  present: studentRecord.present
                });
              }
            }
          }
        }
        
        setAttendanceRecords(records);
      }
    } catch (error) {
      console.error("Error fetching attendance records:", error);
      Alert.alert("Error", "Failed to load attendance records. Please try again.");
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0066cc" />
      </View>
    );
  }
  
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Attendance</Text>
        <Text style={styles.headerSubtitle}>View and submit your attendance records</Text>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Submit Attendance</Text>
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.cardText}>
              Enter the attendance code provided by your lecturer to mark your attendance for today's class.
            </Text>
            
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => navigation.navigate('Submit')}
            >
              <Text style={styles.actionButtonText}>Enter Attendance Code</Text>
            </TouchableOpacity>
          </Card.Content>
        </Card>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Attendance</Text>
        {attendanceRecords.length > 0 ? (
          attendanceRecords
            .sort((a, b) => b.date - a.date)
            .slice(0, 5)
            .map(record => (
              <Card key={record.id} style={styles.card}>
                <Card.Content>
                  <View style={styles.attendanceRow}>
                    <View>
                      <Text style={styles.attendanceCourse}>{record.course}</Text>
                      <Text style={styles.attendanceDate}>
                        {record.date.toLocaleDateString()}
                      </Text>
                    </View>
                    
                    <View style={[
                      styles.attendanceStatus,
                      record.present ? styles.presentStatus : styles.absentStatus
                    ]}>
                      <Text style={styles.attendanceStatusText}>
                        {record.present ? 'Present' : 'Absent'}
                      </Text>
                    </View>
                  </View>
                </Card.Content>
              </Card>
            ))
        ) : (
          <Text style={styles.emptyText}>No attendance records found.</Text>
        )}
        
        <TouchableOpacity 
          style={styles.viewAllButton}
          onPress={() => navigation.navigate('History')}
        >
          <Text style={styles.viewAllText}>View Full History</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Attendance Statistics</Text>
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {attendanceRecords.length > 0 
                    ? Math.round(attendanceRecords.filter(r => r.present).length / attendanceRecords.length * 100) 
                    : 0}%
                </Text>
                <Text style={styles.statLabel}>Overall Attendance</Text>
              </View>
              
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {attendanceRecords.filter(r => r.present).length}
                </Text>
                <Text style={styles.statLabel}>Classes Attended</Text>
              </View>
              
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {attendanceRecords.filter(r => !r.present).length}
                </Text>
                <Text style={styles.statLabel}>Classes Missed</Text>
              </View>
            </View>
          </Card.Content>
        </Card>
      </View>
    </ScrollView>
  );
};

const SubmitAttendanceScreen = ({ navigation }) => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  
  const submitAttendanceCode = async () => {
    // Implement code submission logic
    Alert.alert("Success", "Attendance submitted successfully.");
    navigation.goBack();
  };
  
  return (
    <View style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.cardTitle}>Enter Attendance Code</Text>
          <TextInput
            style={styles.codeInput}
            placeholder="Enter 6-digit code"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            maxLength={6}
          />
          
          <TouchableOpacity 
            style={styles.submitButton}
            onPress={submitAttendanceCode}
            disabled={code.length !== 6 || loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.submitButtonText}>Submit</Text>
            )}
          </TouchableOpacity>
        </Card.Content>
      </Card>
    </View>
  );
};

const AttendanceHistoryScreen = () => {
  // Implement attendance history screen
  return (
    <View style={styles.container}>
      <Text>Attendance History</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#666666',
    marginTop: 4,
  },
  section: {
    padding: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333333',
  },
  card: {
    marginBottom: 12,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 8,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#666666',
    marginTop: 4,
  },
  cardText: {
    fontSize: 14,
    color: '#333333',
    marginBottom: 16,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  actionButton: {
    backgroundColor: '#0066cc',
    padding: 8,
    borderRadius: 4,
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  actionButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  secondaryButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#0066cc',
    marginRight: 0,
    marginLeft: 8,
  },
  secondaryButtonText: {
    color: '#0066cc',
    fontWeight: 'bold',
  },
  emptyText: {
    textAlign: 'center',
    color: '#666666',
    marginVertical: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0066cc',
  },
  statLabel: {
    fontSize: 12,
    color: '#666666',
    marginTop: 4,
  },
  codeContainer: {
    backgroundColor: '#f0f0f0',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 16,
  },
  codeText: {
    fontSize: 32,
    fontWeight: 'bold',
    letterSpacing: 8,
    color: '#333333',
  },
  codeInstructions: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
  },
  studentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  studentName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
  },
  studentEmail: {
    fontSize: 14,
    color: '#666666',
  },
  attendanceToggle: {
    flexDirection: 'row',
  },
  toggleButton: {
    backgroundColor: '#e0e0e0',
    padding: 8,
    borderRadius: 4,
    minWidth: 80,
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: '#4caf50',
  },
  toggleButtonText: {
    color: '#333333',
    fontWeight: 'bold',
  },
  submitButton: {
    backgroundColor: '#0066cc',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    margin: 16,
  },
  submitButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  attendanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  attendanceCourse: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
  },
  attendanceDate: {
    fontSize: 14,
    color: '#666666',
    marginTop: 4,
  },
  attendanceStatus: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  presentStatus: {
    backgroundColor: '#e6f7e6',
  },
  absentStatus: {
    backgroundColor: '#ffe6e6',
  },
  attendanceStatusText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  viewAllButton: {
    alignItems: 'center',
    marginTop: 12,
  },
  viewAllText: {
    color: '#0066cc',
    fontSize: 16,
  },
  codeInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 24,
    textAlign: 'center',
    letterSpacing: 8,
    marginVertical: 16,
  },
});

export default AttendanceScreen;
