一 memory 重构逻辑
1 没有显示全用户输入的信息，前端显示不完整。这个是严重bug
2 memory 里面的对话没按日期分类，有的json文件里面包含不同日期，但是入库都进入一个文件中了
3 要有标题，默认是session id，要显示 Agent工具（openclaw还是claude），标题和Agent工具都要可编辑，后面可能还会加新的选项
4 对标注内容都无法显示，这就很不好 
4 会话标注结构不符合预期，应该个session，每轮会话都能合并到子block中，建议使用 notion block的拖动嵌套逻辑；
memory 应该就是一个标注面板，可以建立标注block，把 session 拖动到建立的标注block里面。 block也是一个NotionBlock，里面可以放各种数据类型

同理，所有http://localhost:3000/memory 和 http://localhost:3000/chronicle 里面的所有标注都建立标准块，都是可拖动的，标注内容是一个 Notion Block块,复用 Blocks 编辑器。




二 chronicle 重构
1 没有删除和编辑页面，导入chronicle不是锁死了，依然可以CRUD；
2 集合和里程碑是建立在时间轴上的，不是三个分离的详情页。有一个视图功能，除了一条条的菜单栏，也能切换为workflow状态的视图，现实集合（里面的task，memory，theory）不同集合直接可以插入箭头来表示逻辑顺序，类似agent工作流的视图

3 http://localhost:3000/chronicle  前端页面完全不符合预期；
你把集合想简单了，集合应该有标题、颜色、内容(notionBlock编辑块)
现在的逻辑不是不能查看task，memory，theory块的内容和标注信息、这些应该点击从库中掉接口查询显示的；块和集合的关系，不是集合里可以选择块 是可以拖动task，memory，theory块到不同集合中的，且拖进来可以看到标题并显示出来，不怕集合臃肿条数多，集合和集合也可以嵌套。你可以这样理解。时间线是按照里程碑标识，V1在V2前面，点击展开V1的内容，这样。集合的内容是可以一直显示的，集合之间也可以嵌套，跟NotionBlock嵌套逻辑一样，但是这里前端显示要遵循  集合> task，memory，theory块 (集合可以嵌套，task，memory，theory块 算是集合里面的元素)

三 task看板bug
http://localhost:3000/tasks/task-2 task选项卡效果很差劲，不满意。重写前端

拖到不稳定，横向纵向拖到不丝滑不能持久化存储；点击每个task 跳转不出来，bug一直修不好，直接重写
而且后端server一直 error，前后端联调根本不成功，点击跟本无法进入task详情页

核心原则：NotionBlock编辑块要大量复用，大量使用点击block块进入NotionBlock编辑的功能，大量使用 NotionBlock块拖动的功能。 但是后端按照模块低耦合存储，走不同后端接口。
chronicle集合又是能兼容 集合和 task，memory，theory块的数据结构。