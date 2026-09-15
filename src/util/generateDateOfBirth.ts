export const generateDateOfBirth = () => {
    const today = new Date();
    const minAge = 18;
    const maxAge = 60;
  
    const max = new Date(
      today.getFullYear() - minAge,
      today.getMonth(),
      today.getDate(),
    );
    const min = new Date(
      today.getFullYear() - maxAge,
      today.getMonth(),
      today.getDate(),
    );
  
    const timestamp =
      min.getTime() + Math.random() * (max.getTime() - min.getTime());
  
    return new Date(timestamp);
  };