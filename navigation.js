import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from './screens/HomeScreen'; // Adjust the path if needed
import DocumentScreen from './screens/DocumentScreen'; // Adjust the path if needed

const Stack = createNativeStackNavigator();

const Navigation = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="DocumentScreen" component={DocumentScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default Navigation;
