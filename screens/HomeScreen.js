import React, { useState, useEffect } from 'react';
import { View, Text, Button, ActivityIndicator, StyleSheet, Image, TextInput, FlatList, TouchableOpacity, Alert } from 'react-native';
import { MaterialIcons } from 'react-native-vector-icons'; // Importing MaterialIcons
import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as Speech from 'expo-speech';
import mammoth from 'mammoth';
import { PDFDocument } from 'pdf-lib'; // For PDF reading
import { Picker } from '@react-native-picker/picker'; // Importing Picker

const SplashScreen = () => (
  <View style={styles.splashContainer}>
    <Image source={require('../assets/logo.png')} style={styles.logo} />
    <Text style={styles.splashText}>Welcome to Document Reader</Text>
  </View>
);

const HomeScreen = ({ navigation }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [folders, setFolders] = useState([]);
  const [folderName, setFolderName] = useState('');
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [isRenaming, setIsRenaming] = useState(null);
  const [destinationFolder, setDestinationFolder] = useState(null);
  const [selectedDocument, setSelectedDocument] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 3000); // 3 seconds delay

    return () => clearTimeout(timer); // Cleanup timer on unmount
  }, []);

  const navigate = async (document) => {
    navigation.navigate('DocumentScreen', { uri: document.uri, name: document.name });
  };

  const createFolder = () => {
    if (folderName.trim()) {
      setFolders([...folders, { name: folderName, documents: [] }]);
      setFolderName('');
      setMessage('Folder created successfully!');
    } else {
      setMessage('Please enter a folder name.');
    }
  };

  const deleteFolder = (folderIndex) => {
    const updatedFolders = folders.filter((_, index) => index !== folderIndex);
    setFolders(updatedFolders);
    setMessage('Folder deleted successfully!');
  };

  const deleteDocument = (folderIndex, documentIndex) => {
    const updatedFolders = folders.map((folder, fIndex) => 
      fIndex === folderIndex
        ? {
            ...folder,
            documents: folder.documents.filter((_, dIndex) => dIndex !== documentIndex),
          }
        : folder
    );
    setFolders(updatedFolders);
    setMessage('Document deleted successfully!');
  };

  const pickDocument = async (folderIndex) => {
    setLoading(true);
    setMessage('');
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: '*/*',
      });
      if (!res.canceled) {
        const document = res.assets[0];
        const updatedFolders = [...folders];
        updatedFolders[folderIndex].documents.push(document);
        setFolders(updatedFolders);
        setMessage('Document uploaded successfully!');
      } else {
        setMessage('User cancelled the picker');
      }
    } catch (err) {
      console.error(err);
      setMessage('Error picking document: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  


  const renameFolder = (oldName, newName) => {
    if (newName && !folders.some(folder => folder.name === newName)) {
      const updatedFolders = folders.map(folder => 
        folder.name === oldName ? { ...folder, name: newName } : folder
      );
      setFolders(updatedFolders);
      Alert.alert('Folder renamed successfully!');
    } else {
      Alert.alert('Invalid folder name. Please try again.');
    }
  };

  // Function to move a document from one folder to another
  const moveDocument = (sourceFolderIndex, destinationFolderIndex, documentIndex) => {
    if (sourceFolderIndex !== destinationFolderIndex) {
      // Get the document to move
      const documentToMove = folders[sourceFolderIndex].documents[documentIndex];

      // Add the document to the destination folder
      const updatedFolders = [...folders];
      updatedFolders[destinationFolderIndex].documents.push(documentToMove);

      // Remove the document from the source folder
      updatedFolders[sourceFolderIndex].documents = updatedFolders[sourceFolderIndex].documents.filter(
        (_, index) => index !== documentIndex
      );

      setFolders(updatedFolders);
      setMessage('Document moved successfully!');
      setSelectedDocument(null); // Reset selected document after moving
    } else {
      setMessage('Source and destination folders are the same.');
    }
  };

  if (isLoading) {
    return <SplashScreen />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Document Reader</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter folder name"
        value={folderName}
        onChangeText={setFolderName}
      />
      <Button title="Create Folder" onPress={createFolder} color="#4CAF50" />
      <FlatList
        data={folders}
        keyExtractor={(item, index) => index.toString()}
        renderItem={({ item, index }) => (
          <View style={styles.folderContainer}>
            {isRenaming === index ? (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="New folder name"
                  value={newFolderName}
                  onChangeText={setNewFolderName}
                />
                <TouchableOpacity onPress={() => {
                  renameFolder(item.name, newFolderName);
                  setNewFolderName('');
                  setIsRenaming(null);
                }}>
                  <MaterialIcons name="check" size={24} color="#4CAF50" /> 
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.folderRow}>
                <Text style={styles.folderName}>{item.name}</Text>
                <TouchableOpacity onPress={() => setIsRenaming(index)}>
                 <MaterialIcons name="edit" size={24} color="#2196F3" /> 
                </TouchableOpacity>
              </View>
            )}
            <View style={styles.buttonContainer}>
              <TouchableOpacity onPress={() => pickDocument(index)} style={styles.iconButton}>
                <MaterialIcons name="upload-file" size={24} color="#2196F3" />
                <Text style={styles.buttonText}>Upload Document</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => deleteFolder(index)} style={styles.iconButton}>
                <MaterialIcons name="delete" size={24} color="#FF5733" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={item.documents}
              keyExtractor={(doc, docIndex) => docIndex.toString()}
              renderItem={({ item: document, index: documentIndex }) => (
                <View style={styles.documentRow}>
                  <TouchableOpacity onPress={() => navigate(document)}>
                    <Text style={styles.documentName}>{document.name}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => deleteDocument(index, documentIndex)}>
                    <MaterialIcons name="delete" size={24} color="#9C27B0" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setSelectedDocument({ folderIndex: index, documentIndex })}>
                    <MaterialIcons name="move-to-inbox" size={24} color="#4CAF50" />
                  </TouchableOpacity>
                </View>
              )}
            />
          </View>
        )}
      />
      {selectedDocument && (
        <View style={styles.moveContainer}>
          <Text>Select destination folder:</Text>
          <Picker
            selectedValue={destinationFolder}
            onValueChange={(value) => setDestinationFolder(value)}
            style={styles.picker}
          >
            {folders.map((folder, folderIndex) => (
              <Picker.Item key={folderIndex} label={folder.name} value={folderIndex} />
            ))}
          </Picker>
          <Button
            title="Move Document"
            onPress={() => moveDocument(selectedDocument.folderIndex, destinationFolder, selectedDocument.documentIndex)}
            color="#4CAF50"
          />
        </View>
      )}
      {loading && <ActivityIndicator size="large" color="#0000ff" />}
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
};

export default HomeScreen;

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5', // Plain background
  },
  logo: {
    width: 100, // Adjust width as needed
    height: 100, // Adjust height as needed
    marginBottom: 20, // Space between logo and text
  },
  splashText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333', // Dark text
  },
  container: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  input: {
    height: 40,
    borderColor: 'gray',
    borderWidth: 1,
    marginBottom: 10,
    width: '100%',
    paddingHorizontal: 10,
  },
  folderContainer: {
    marginVertical: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    width: '100%',
  },
  folderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  folderName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 50,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 10,
  },
  iconButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonText: {
    marginLeft: 5,
    fontSize: 16,
  },
  documentName: {
    fontSize: 16,
    color: '#007BFF',
    marginTop: 5,
  },
  documentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  message: {
    marginTop: 20,
    fontSize: 16,
    color: 'green',
  },
  picker: {
    height: 50,
    width: '100%',
    marginTop: 10,
  },
  moveContainer: {
    marginTop: 20,
    padding: 10,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    width: '100%',
  },
});
