import config from '../config';

const QuizContext = createContext();

export const QuizProvider = ({ children }) => {
  const [student, setStudent] = useState(JSON.parse(localStorage.getItem('student')) || null);
  const [isAdmin, setIsAdmin] = useState(!!localStorage.getItem('adminAuth'));
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const newSocket = io(config.SOCKET_URL);
    setSocket(newSocket);
    return () => newSocket.close();
  }, []);

  useEffect(() => {
    if (student && socket) {
      socket.emit('join-room', student.techziteId);
    }
  }, [student, socket]);

  const login = (studentData) => {
    localStorage.setItem('student', JSON.stringify(studentData));
    setStudent(studentData);
  };

  const logout = () => {
    localStorage.removeItem('student');
    localStorage.removeItem('adminAuth');
    setStudent(null);
    setIsAdmin(false);
  };

  return (
    <QuizContext.Provider value={{ student, setStudent, isAdmin, setIsAdmin, socket, login, logout }}>
      {children}
    </QuizContext.Provider>
  );
};

export const useQuiz = () => useContext(QuizContext);
