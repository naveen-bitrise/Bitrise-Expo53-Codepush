import { StatusBar } from 'expo-status-bar';
import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  Keyboard,
  Alert
} from 'react-native';
import codePush from '@code-push-next/react-native-code-push';

function App() {
  // Log current package information on app start
  useEffect(() => {
    // Add custom error handler
    const originalConsoleError = console.error.bind(console);
    console.error = function (message, ...args) {
      console.log("[CodePushDebug] Error intercepted:", message, ...args);
      return originalConsoleError(message, ...args);
    };

    // Monitor network requests
    const originalFetch = global.fetch;
    global.fetch = function (input, init) {
      console.log("[CodePushDebug] Fetch request to:", typeof input === 'string' ? input : 'Request object');
      return originalFetch(input, init)
        .then(response => {
          console.log("[CodePushDebug] Fetch success for:", typeof input === 'string' ? input : 'Request object');
          return response;
        })
        .catch(error => {
          console.log("[CodePushDebug] Fetch error:", error);
          throw error;
        });
    };

    codePush.getUpdateMetadata().then((metadata) => {
      if (metadata) {
        console.log('[CodePush] Running binary version: ' + metadata.appVersion);
        console.log('[CodePush] Running with CodePush update: ' + metadata.label);
        console.log('[CodePush] Package hash: ' + metadata.packageHash);
        console.log('[CodePush] Package description: ' + metadata.description);
      } else {
        console.log('[CodePush] Running binary version with no CodePush updates installed');
      }

      // After getting metadata, check for updates
      console.log('[CodePush] Checking for update.');
    }).catch(err => {
      console.log('[CodePush] Error getting metadata:', err);
    });
  }, []);

  const [task, setTask] = useState('');
  const [tasks, setTasks] = useState([]);
  const [editIndex, setEditIndex] = useState(-1);

  const handleAddTask = () => {
    Keyboard.dismiss();
    if (task.trim() === '') {
      Alert.alert('No task entered', 'Please enter a task.');
      return;
    }
    if (editIndex !== -1) {
      const updatedTasks = [...tasks];
      updatedTasks[editIndex] = { text: task, completed: tasks[editIndex].completed };
      setTasks(updatedTasks);
      setEditIndex(-1);
    } else {
      setTasks([...tasks, { text: task, completed: false }]);
    }
    setTask('');
  };

  const handleToggleComplete = (index) => {
    const updatedTasks = [...tasks];
    updatedTasks[index].completed = !updatedTasks[index].completed;
    setTasks(updatedTasks);
  };

  const handleEditTask = (index) => {
    setTask(tasks[index].text);
    setEditIndex(index);
  };

  const handleDeleteTask = (index) => {
    Alert.alert(
      "Delete Task",
      "Are you sure you want to delete this task?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Delete",
          onPress: () => {
            const updatedTasks = [...tasks];
            updatedTasks.splice(index, 1);
            setTasks(updatedTasks);
          },
          style: "destructive"
        }
      ]
    );
  };

  const handleClearCompletedTasks = () => {
    Alert.alert(
      "Clear Completed Tasks",
      "Are you sure you want to clear all completed tasks?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Clear",
          onPress: () => {
            const remainingTasks = tasks.filter(task => !task.completed);
            setTasks(remainingTasks);
          },
          style: "destructive"
        }
      ]
    );
  };

  const renderItem = ({ item, index }) => (
    <View style={styles.taskItemContainer}>
      <TouchableOpacity onPress={() => handleToggleComplete(index)} style={styles.taskTextContainer}>
        <Text style={[styles.taskText, item.completed && styles.completedTaskText]}>
          {item.text}
        </Text>
      </TouchableOpacity>
      <View style={styles.buttonsContainer}>
        <TouchableOpacity onPress={() => handleEditTask(index)} style={[styles.button, styles.editButton]}>
          <Text style={styles.buttonText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleDeleteTask(index)} style={[styles.button, styles.deleteButton]}>
          <Text style={styles.buttonText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      <Text style={styles.title}>My To-Dos List</Text>
      <Text style={styles.codepushInfoText}>CodePush Integrated Expo App</Text>
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Add a new task..."
          value={task}
          onChangeText={setTask}
          onSubmitEditing={handleAddTask}
        />
        <TouchableOpacity onPress={handleAddTask} style={styles.addButton}>
          <Text style={styles.addButtonText}>{editIndex !== -1 ? 'Update Task' : 'Add Task'}</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={tasks}
        renderItem={renderItem}
        keyExtractor={(item, index) => index.toString()}
        style={styles.list}
        ListEmptyComponent={<Text style={styles.emptyListText}>No tasks yet. Add some!</Text>}
      />
      {tasks.some(task => task.completed) && (
        <TouchableOpacity onPress={handleClearCompletedTasks} style={styles.clearButton}>
          <Text style={styles.clearButtonText}>Clear Completed Tasks</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// Original styles from the uploaded App.js are minimal, so we'll use more comprehensive ones for the to-do app
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0', // Changed background for better visibility of elements
    paddingTop: 60, // Added padding for status bar and title
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10, // Reduced margin slightly
    textAlign: 'center',
    color: '#333',
  },
  codepushInfoText: {
    textAlign: 'center',
    fontSize: 12,
    color: 'gray',
    marginBottom: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    height: 50,
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    marginRight: 10,
  },
  addButton: {
    backgroundColor: '#007bff',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    height: 50,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  list: {
    flex: 1,
  },
  taskItemContainer: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#eee',
    elevation: 2, // Added shadow for Android
    shadowColor: '#000', // Added shadow for iOS
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  taskTextContainer: {
    flex: 1, // Allows text to take available space before buttons
    marginRight: 10, // Add some space between text and buttons
  },
  taskText: {
    fontSize: 18,
    color: '#333',
  },
  completedTaskText: {
    textDecorationLine: 'line-through',
    color: '#aaa',
  },
  buttonsContainer: {
    flexDirection: 'row',
  },
  button: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 5,
    marginLeft: 8, // Space between buttons
    justifyContent: 'center',
    alignItems: 'center',
  },
  editButton: {
    backgroundColor: '#ffc107', // Yellow
  },
  deleteButton: {
    backgroundColor: '#dc3545', // Red
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  emptyListText: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
    color: '#777',
  },
  clearButton: {
    backgroundColor: '#6c757d', // Secondary/gray color
    paddingVertical: 15,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10, // Add margin if there's a list above
    marginBottom: 20, // Space at the bottom
  },
  clearButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

// CodePush configuration (remains the same as your original file)
const codePushOptions = {
  checkFrequency: codePush.CheckFrequency.ON_APP_START,
  installMode: codePush.InstallMode.IMMEDIATE,
  mandatoryInstallMode: codePush.InstallMode.IMMEDIATE,
  updateDialog: {
    appendReleaseDescription: true,
    title: "Update Available",
    descriptionPrefix: "\n\nRelease Notes:\n",
    mandatoryContinueButtonLabel: "Install Now",
    mandatoryUpdateMessage: "An update is available that must be installed.",
    optionalIgnoreButtonLabel: "Later",
    optionalInstallButtonLabel: "Install Now",
    optionalUpdateMessage: "An update is available. Would you like to install it?"
  }
};

export default codePush(codePushOptions)(App);