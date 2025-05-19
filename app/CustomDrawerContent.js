import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image } from 'react-native';
import { DrawerContentScrollView, DrawerItemList, DrawerItem } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../firebaseConfig';

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

const CustomDrawerContent = (props) => {
  const { userRole, state } = props;
  
  return (
    <DrawerContentScrollView 
      {...props}
      contentContainerStyle={{backgroundColor: COLORS.background}}
    >
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
        <DrawerItemList 
          {...props}
          activeTintColor={COLORS.primary}
          activeBackgroundColor="#e6ffe6"
          inactiveTintColor={COLORS.text}
          itemStyle={styles.drawerItem}
          labelStyle={styles.drawerItemLabel}
        />
      </View>
      
      <View style={styles.bottomDrawerSection}>
        <TouchableOpacity 
          style={styles.signOutButton}
          onPress={() => auth.signOut()}
        >
          <Ionicons name="log-out-outline" size={22} color={COLORS.error} />
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
    backgroundColor: COLORS.primary,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: 10,
  },
  userInfoSection: {
    alignItems: 'center',
  },
  profileImageContainer: {
    marginBottom: 10,
    borderWidth: 3,
    borderColor: COLORS.secondary,
    borderRadius: 43, // Slightly larger than the image radius
    padding: 3,
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  userEmail: {
    fontSize: 14,
    color: '#FFFFFF',
    marginTop: 2,
    opacity: 0.9,
  },
  roleBadge: {
    backgroundColor: COLORS.secondary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    marginTop: 8,
  },
  roleText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  drawerSection: {
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: 'bold',
    paddingHorizontal: 16,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
    paddingLeft: 16,
  },
  bottomDrawerSection: {
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 15,
    paddingHorizontal: 16,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    backgroundColor: '#FFF0F0',
    padding: 12,
    borderRadius: 8,
  },
  signOutText: {
    fontSize: 16,
    color: COLORS.error,
    marginLeft: 10,
    fontWeight: 'bold',
  },
  drawerItem: {
    borderLeftWidth: 0,
    marginVertical: 2,
  },
  drawerItemActive: {
    backgroundColor: '#e6ffe6',
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  drawerItemLabel: {
    color: COLORS.text,
    fontWeight: 'normal',
  },
  drawerItemLabelActive: {
    color: COLORS.primary,
    fontWeight: 'bold',
  },
});

export default CustomDrawerContent;