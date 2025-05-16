// CustomDrawerContent.js
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image } from 'react-native';
import { DrawerContentScrollView, DrawerItemList } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../firebaseConfig';

const CustomDrawerContent = (props) => {
  const { userRole } = props;
  
  return (
    <DrawerContentScrollView {...props}>
      <View style={styles.drawerHeader}>
        <View style={styles.userInfoSection}>
          <View style={styles.profileImageContainer}>
            <Image 
              source={{ uri: "https://via.placeholder.com/150" }} 
              style={styles.profileImage} 
            />
          </View>
          <Text style={styles.userName}>{auth.currentUser?.displayName || 'User'}</Text>
          <Text style={styles.userEmail}>{auth.currentUser?.email}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>
              {userRole.charAt(0).toUpperCase() + userRole.slice(1)}
            </Text>
          </View>
        </View>
      </View>
      
      <View style={styles.drawerSection}>
        <Text style={styles.sectionTitle}>MAIN NAVIGATION</Text>
        <DrawerItemList {...props} />
      </View>
      
      <View style={styles.bottomDrawerSection}>
        <TouchableOpacity 
          style={styles.signOutButton}
          onPress={() => auth.signOut()}
        >
          <Ionicons name="log-out-outline" size={22} color="#ff3b30" />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </DrawerContentScrollView>
  );
};

const styles = StyleSheet.create({
  drawerHeader: {
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    marginBottom: 10,
  },
  userInfoSection: {
    alignItems: 'center',
  },
  profileImageContainer: {
    marginBottom: 10,
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
  },
  userEmail: {
    fontSize: 14,
    color: '#666666',
    marginTop: 2,
  },
  roleBadge: {
    backgroundColor: '#e6f0ff',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    marginTop: 8,
  },
  roleText: {
    fontSize: 14,
    color: '#0066cc',
    fontWeight: 'bold',
  },
  drawerSection: {
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 12,
    color: '#666666',
    fontWeight: 'bold',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  bottomDrawerSection: {
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 15,
    paddingHorizontal: 16,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  signOutText: {
    fontSize: 16,
    color: '#ff3b30',
    marginLeft: 10,
  },
});

export default CustomDrawerContent;