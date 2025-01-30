import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { PDFDocument } from 'pdf-lib';
import mammoth from 'mammoth';

const DocumentScreen = ({ route }) => {
  const { uri, name } = route.params;
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const readDocument = async () => {
      try {
        let fileContent;

        if (uri.endsWith('.txt')) {
          // Read text file
          fileContent = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.UTF8 });
        } else if (uri.endsWith('.pdf')) {
          // Read PDF file
          const pdfBytes = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
          const pdfDoc = await PDFDocument.load(pdfBytes);
          const pdfText = await pdfDoc.getTextContent();
          fileContent = pdfText.items.map(item => item.str).join(' ');
        } else if (uri.endsWith('.docx')) {
          // Read Word document
          const arrayBuffer = await FileSystem.readAsArrayBuffer(uri);
          const { value } = await mammoth.extractRawText({ arrayBuffer });
          fileContent = value;
        } else {
          fileContent = 'Unsupported file format';
        }

        setContent(fileContent);
      } catch (error) {
        setContent('Error reading document: ' + error.message);
      } finally {
        setLoading(false);
      }
    };

    readDocument();
  }, [uri]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{name}</Text>
      <ScrollView style={styles.documentContent}>
        {loading ? <ActivityIndicator size="large" color="#0000ff" /> : <Text>{content}</Text>}
      </ScrollView>
    </View>
  );
};

export default DocumentScreen;

const styles = StyleSheet.create({
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
  documentContent: {
    marginTop: 20,
    padding: 10,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    width: '100%',
    maxHeight: '80%', // Adjusted to make sure it's scrollable
  },
});
