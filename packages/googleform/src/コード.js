function setDateChoices() {
  let form = FormApp.getActiveForm();
  let items = form.getItems();
  let item = items.filter(item => item.getTitle() == '見学日')[0];

  let now = new Date();
  let y = now.getFullYear();
  let m = now.getMonth();
  let d = now.getDate();
  let days = ['日', '月', '火', '水', '木', '金', '土'];

   let choices = [];
   for(let i = 0; i <30; i++){
    let date = new Date(y, m, d+i);
    let day = date.getDay();
    date= Utilities.formatDate(date, 'Asia/Tokyo', `yyyy年M月d日(${days[day]})`)
    choices.push(date);

   }
item.asListItem().setChoiceValues(choices);
}

function setTimeChoices() {
  let form = FormApp.getActiveForm();
  let items = form.getItems();
  let item = items.filter(item => item.getTitle() == '見学時間')[0];

  let choices = [];
  for(let h = 10; h < 20; h++){
    choices.push(`${h}:00`, `${h}:30`);
  }

  item.asListItem().setChoiceValues(choices);
}