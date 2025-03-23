import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  Switch,
  Alert,
  ActivityIndicator
} from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Card } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../firebaseConfig';
import {  signOut } from "firebase/auth";
import { 
  collection, 
  doc, 
  getDoc, 
  updateDoc, 
} from 'firebase/firestore';

const Stack = createNativeStackNavigator();

const SettingsScreen = ({ route }) => {
  const { userRole } = route.params;
  
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="Settings" 
        component={SettingsMainScreen} 
        options={{ headerShown: false }}
        initialParams={{ userRole }}
      />
      <Stack.Screen 
        name="Profile" 
        component={ProfileScreen} 
        options={{ title: 'Edit Profile' }}
      />
      <Stack.Screen 
        name="Preferences" 
        component={PreferencesScreen} 
        options={{ title: 'Teaching Preferences' }}
      />
      <Stack.Screen 
        name="Notifications" 
        component={NotificationsScreen} 
        options={{ title: 'Notification Settings' }}
      />
    </Stack.Navigator>
  );
};

const SettingsMainScreen = ({ route, navigation }) => {
  const { userRole } = route.params;
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchUserData();
  }, []);
  
  const fetchUserData = async () => {
    try {
      setLoading(true);
      const currentUser = auth.currentUser;
      if (!currentUser) return;
      
      // Get user data from Firestore
      const userRef = doc(db, "users", currentUser.uid);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        setUser({
          id: currentUser.uid,
          email: currentUser.email,
          ...userDoc.data()
        });
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
      Alert.alert("Error", "Failed to load user data. Please try again.");
    } finally {
      setLoading(false);
    }
  };
  
  const handleSignOut = async () => {
    try {
      await signOut(auth);
      // Navigation will be handled by the auth state listener in App.js
    } catch (error) {
      console.error("Error signing out:", error);
      Alert.alert("Error", "Failed to sign out. Please try again.");
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
        <Text style={styles.headerTitle}>Settings</Text>
        <Text style={styles.headerSubtitle}>Manage your account and preferences</Text>
      </View>
      
      <View style={styles.profileCard}>
        <View style={styles.profileAvatar}>
          <Text style={styles.profileInitials}>
            {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
          </Text>
        </View>
        
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{user?.name || 'User'}</Text>
          <Text style={styles.profileEmail}>{user?.email || ''}</Text>
          <Text style={styles.profileRole}>{userRole.charAt(0).toUpperCase() + userRole.slice(1)}</Text>
        </View>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        
        <TouchableOpacity 
          style={styles.settingItem}
          onPress={() => navigation.navigate('Profile')}
        >
          <Ionicons name="person-outline" size={24} color="#0066cc" />
          <Text style={styles.settingText}>Edit Profile</Text>
          <Ionicons name="chevron-forward" size={24} color="#cccccc" />
        </TouchableOpacity>
        
        {userRole === 'lecturer' && (
          <TouchableOpacity 
            style={styles.settingItem}
            onPress={() => navigation.navigate('Preferences')}
          >
            <Ionicons name="time-outline" size={24} color="#0066cc" />
            <Text style={styles.settingText}>Teaching Preferences</Text>
            <Ionicons name="chevron-forward" size={24} color="#cccccc" />
          </TouchableOpacity>
        )}
        
        <TouchableOpacity 
          style={styles.settingItem}
          onPress={() => navigation.navigate('Notifications')}
        >
          <Ionicons name="notifications-outline" size={24} color="#0066cc" />
          <Text style={styles.settingText}>Notification Settings</Text>
          <Ionicons name="chevron-forward" size={24} color="#cccccc" />
        </TouchableOpacity>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>App</Text>
        
        <View style={styles.settingItem}>
          <Ionicons name="moon-outline" size={24} color="#0066cc" />
          <Text style={styles.settingText}>Dark Mode</Text>
          <Switch 
            value={false} 
            onValueChange={() => Alert.alert("Coming Soon", "Dark mode will be available in a future update.")}
          />
        </View>
        
        <TouchableOpacity 
          style={styles.settingItem}
          onPress={() => Alert.alert("App Version", "Timetable Scheduler v1.0.0")}
        >
          <Ionicons name="information-circle-outline" size={24} color="#0066cc" />
          <Text style={styles.settingText}>About</Text>
          <Ionicons name="chevron-forward" size={24} color="#cccccc" />
        </TouchableOpacity>
      </View>
      
      <TouchableOpacity 
        style={styles.signOutButton}
        onPress={handleSignOut}
      >
        <Text style={styles.signOutButtonText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const ProfileScreen = () => {
  // Implement profile editing screen
  return (
    <View style={styles.container}>
      <Text>Edit Profile</Text>
    </View>
  );
};

const PreferencesScreen = () => {
  // Implement teaching preferences screen
  return (
    <View style={styles.container}>
      <Text>Teaching Preferences</Text>
    </View>
  );
};

const NotificationsScreen = () => {
  // Implement notification settings screen
  return (
    <View style={styles.container}>
      <Text>Notification Settings</Text>
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
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 16,
    marginTop: 16,
    marginHorizontal: 16,
    borderRadius: 8,
    elevation: 2,
  },
  profileAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#0066cc',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  profileInitials: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
  },
  profileEmail: {
    fontSize: 14,
    color: '#666666',
    marginTop: 2,
  },
  profileRole: {
    fontSize: 14,
    color: '#0066cc',
    marginTop: 4,
  },
  section: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    marginHorizontal: 16,
    marginTop: 24,
    padding: 16,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333333',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingText: {
    flex: 1,
    fontSize: 16,
    color: '#333333',
    marginLeft: 16,
  },
  signOutButton: {
    backgroundColor: '#ff3b30',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    margin: 16,
  },
  signOutButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default SettingsScreen;
