function myFunction() {
  let now = new Date();
  let y = now.getFullYear();
  let m = now.getMonth();
  let d = now.getDate();
  let days = ['日', '月', '火', '水', '木', '金', '土'];

  let choices = [];
  for(let i = 0; i < 30; i++){
    let date = new Date(y, m, d+i);
    let day = date.getDay();
    date = Utilities.formatDate(date, 'Asia/Tokyo', `yyyy年M月d日(${days[day]})`);
    choices.push(date);
  }

  console.log(choices);
}
