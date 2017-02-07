/**
 * Created by Brain on 2017/02/04
 * 作者: Brain
 * 开发方式: 采用对象级别组件开发
 *
 * 1、对象级别组件开发: 挂在jQuery原型下的方法，通过jQuery选择器获取的对象实例也能共享该方法，成为动态方法
 *  $.fn.fullPageSlide = function(){}; $.fn === $.prototype
 *
 * 2、实现jQuery的链式调用
 *  $.fn.fullPageSlide = function(){
 *      return this.each(function(){});
 *  }
 *  each，循环实现每个元素的访问
 *  return this，表示返回当前对象，来实现插件的链式调用
 *
 * 3、单例模式（如果实例不存在则重新创建实例，利用data()来存放插件对象的实例）
 *  $.fn.fullPageSlide = function(){
 *      var me = $(this),
 *          instance = me.data('fullPageSlide');
 *      if (!instance){
 *          me.data('fullPageSlide',(instance = new fullPageSlide()));
 *      }
 *  };
 */
;
(function($) {
    /*说明:获取浏览器前缀*/
    /*实现：判断某个元素的css样式中是否存在transition属性*/
    /*参数：dom元素*/
    /*返回值：boolean，有则返回浏览器样式前缀，否则返回false*/
    var _prefix = (function(temp) {
        var aPrefix = ["webkit", "Moz", "o", "ms"],
            props = "";
        for (var i in aPrefix) {
            props = aPrefix[i] + "Transition";
            if (temp.style[props] !== undefined) {
                return "-" + aPrefix[i].toLowerCase() + "-";
            }
        }
        return false;
    })(document.createElement(FullPageSlide));

    var FullPageSlide = (function() {
        function FullPageSlide(element, options) {
            this.setting = $.extend(true, $.fn.FullPageSlide.defaults, options || {}); //深拷贝把用户自定义的参数与插件默认的参数合并，也就是扩展到setting
            this.element = element;
            this.init();

        };
        FullPageSlide.prototype = {
            /*初始化DOM结构，布局，分页及绑定事件*/
            init: function() {
                var _this = this;

                /**
                 * 初始化DOM，用d_前缀表示
                 */
                this.d_sectionWrap = $('#J-fullPageSlide .section-wrapper');
                this.d_section = $('#J-fullPageSlide .section');

                /**
                 * 初始化设置，用s_前缀表示
                 */
                this.s_navMenu = this.setting.navMenu;
                this.s_author = this.setting.author;
                // this.s_direction是布尔值
                this.s_direction = this._disposeDirection();
                this.s_isScrolling = this.setting.isScrolling;
                this.s_index = this.setting.index >= 0 && this.setting.index < this._getSectionCount() ? this.setting.index : 0;
                this.s_active = this.setting.active;
                this.s_isLoop = this.setting.isLoop;
                this.s_duration = this.setting.duration;
                this.s_easing = this.setting.easing;
                this.s_afterLoad = this.setting.afterLoad;
                this.s_onLeave = this.setting.onLeave;

                /**
                 * 根据功能需求自定义的变量b_前缀表示
                 */
                /**
                 * 保存每个section的区间,当用户用于浏览器自带的滚动条时,在离开第一屏topHeader应该为顶部固定,当进入第一屏时呢,则让topHeader继续在文档流中
                 * 之所以不用onLeave()这个回调方法,是因为这个方法是在用户调用FullPageSlide时才会去触发,而我本身是希望这个功能是内置的
                 * 实现:见_linkageScrolling()方法
                 * @type {Array}
                 */
                this.b_tiggerSection = [];
                this.b_finshed = true;
                this.b_canScroll = true;

                // 渲染导航条
                this.renderNav();
                /*
                    设置sectionWrap的高度，如果isScrolling为false，那么设置sectionWrap的高度为section高度 * section.length；
                    若isScrolling为true，那么设置html，body，sectionWrap，section的高度都为100%，并且overflow: hidden
                */
                if (this.s_isScrolling) {
                    if (this.s_direction) {
                        this._initVertiLayout();
                    } else {
                        this._initHorizLayout();
                    }
                } else {
                    // 这里写关于没有滚动条的代码
                    if (this.s_direction) {
                        this._initVertiLayout();
                        $('html, body').css({
                            // 初始化DOM设置
                            height: $(window).height(),
                            overflow: 'hidden'
                        });
                    } else {
                        this._initHorizLayout();
                        $('html, body').css({
                            // 初始化DOM设置
                            height: $(window).width(),
                            overflow: 'hidden'
                        });
                    }
                }

                this.scrollAnimate();

                // 初始化事件
                this._initEvent();

                this._afterScrolling();

                this._setMenuActive();

                _this._isReTopHeader();

                _this._dynamicPageSize();
            },
            //其它功能

            // 渲染出导航条
            renderNav: function() {
                var _this = this;
                if (this.s_navMenu.length > 0) {

                    // 保存顶部导航菜单的DOM结构
                    var topHeader = $('<header class="topHeader"><h1 class="author menu-item"><a href="javascript:;">' + this.s_author + '</a></h1><nav class="topNav"><ul></ul></nav></header>');
                    this.d_sectionWrap.children().eq(0).after(topHeader);

                    // 保存topHeader 的DOM
                    this.d_topHeader = $('.topHeader');

                    // 解决获取每屏top值,由于之前是文档流,获取到的top值会包含进去,最开始就fixed
                    // 并且在有滚动条是才会出现这种情况
                    if (_this.s_isScrolling) {
                        this.d_topHeader.css({
                            position: 'absolute',
                            top: _this.d_section.eq(1).position().top - _this.d_topHeader.height(),
                            left: 0,
                            width: $(window).width(),
                            boxSizing: 'border-box'
                        });
                    }

                    var ulList = $('.topHeader .topNav ul');

                    // 遍历用户传进来的菜单，渲染出菜单的DOM结构
                    $.each(_this.s_navMenu, function(index, data) {
                        var liItem = $('<li class="menu-item"><a href="javascript:;">' + data + '</a></li>');
                        ulList.append(liItem);
                    });
                }
            },

            // 上一屏
            prevSlide: function() {
                if (this.s_index > 0) {
                    this.s_index--;
                } else if (this.s_isLoop) {
                    this.s_index = this._getSectionCount() - 1;
                }
                this._setMenuActive();
                this.scrollAnimate();
            },

            // 下一屏
            nextSlide: function() {
                if (this.s_index < this._getSectionCount() - 1) {
                    this.s_index++;
                } else if (this.s_isLoop) {
                    this.s_index = 0;
                }
                this._setMenuActive();
                this.scrollAnimate();
            },

            // 滚屏动画
            scrollAnimate: function() {
                var _this = this;
                this._isReTopHeader();
                this._dynamicPageSize();
                // 获取当前屏的top和left值,用position()方法
                var sectionPosition = this.d_section.eq(_this.s_index).position();
                // 如果是在浏览器默认滚动条就用scrollTop和scrollLeft滚动滚动条的方式实现动画
                if (this.s_isScrolling && (_this.s_isScrolling && _this.s_direction)) {
                    _this.s_direction ? $('body').animate({
                        scrollTop: sectionPosition.top
                    }, 'slow') : $('body').animate({
                        scrollLeft: sectionPosition.left
                    }, 'slow');
                } else {
                    // 如果是全屏滚动的方式,则用translate的css3来实现动画
                    this.d_sectionWrap.find('.topHeader').remove();
                    this.element.append(this.d_topHeader);
                    this.d_topHeader.addClass('topHeader-fixed');
                    if (!_this.s_index) {
                        sectionPosition = 0;
                    } else {
                        _this.s_direction ? (sectionPosition = this.d_section.eq(_this.s_index).position().top - this.d_section.eq(0).position().top) : (sectionPosition = this.d_section.eq(_this.s_index).position().left - this.d_section.eq(0).position().left);
                    }
                    this.b_canScroll = false

                    if (_prefix) {
                        var translate = _this.s_direction ? "translateY(-" + sectionPosition + "px)" : "translateX(-" + sectionPosition + "px)";
                        this.d_sectionWrap.css(_prefix + "transition", "all " + _this.s_duration + "ms " + _this.s_easing);
                        this.d_sectionWrap.css(_prefix + "transform", translate);
                    } else {
                        var animateCss = this.s_direction ? {
                            top: -sectionPosition.top
                        } : {
                            left: -sectionPosition.left
                        };
                        this.d_sectionWrap.animate(animateCss, _this.s_duration, function() {
                            _this.b_canScroll = true;
                        });
                    }
                }
            },

            // 设置当前活动的菜单
            _setMenuActive: function() {
                var _this = this;
                _this.d_topHeader.find('.menu-item').removeClass(_this.s_active);
                _this.d_topHeader.find('.menu-item a').css({
                    color: '#fff'
                });
                _this.d_topHeader.find('.menu-item').eq(_this.s_index).addClass(_this.s_active);
                _this.d_topHeader.find('.menu-item.' + _this.s_active + ' a').css({
                    color: '#ccc'
                });

            },

            // 获取到section的总数,私有方法
            _getSectionCount: function() {
                return this.d_section.length;
            },

            // 获取section-wrapper的高度,需要考虑是横屏还是竖屏展示
            _getSectionWrapSize: function() {
                if (this.s_direction) {
                    return this.element.height();
                } else {
                    return this.element.width();
                }
            },

            // 竖屏布局,初始化高度
            _initVertiLayout: function() {
                var _this = this;
                $('html, body').css({
                    height: $(window).height() * _this._getSectionCount()
                });
                this.d_section.css({
                    height: $(window).height()
                });
                this.d_topHeader.removeClass('topHeader-fixed');
            },

            // 横屏布局,初始化宽度
            _initHorizLayout: function() {
                var _this = this;
                // 得到section的数量*100,再换成百分值,e.g. 500%
                var sectionWrapWidth = (_this._getSectionCount() * 100) + "%";
                // 100/section的数量,四舍五入保存两位小数点,换成百分值,e.g. 20%
                // 这里测试到在除奇数时会有偏差导致渲染不下,导致布局换行,换成toFixed(4)
                var sectionWidth = (100 / _this._getSectionCount()).toFixed(4) + "%";

                _this.d_sectionWrap.width(sectionWrapWidth);
                _this.d_section.width(sectionWidth).css({
                    'float': 'left'
                });

                // 为了让横屏布局后,总宽度变得很宽,这时顶部header在文档流会影响布局
                this.d_sectionWrap.find('.topHeader').remove();
                this.element.append(this.d_topHeader);
                this.d_topHeader.addClass('topHeader-fixed');
            },

            // 处理direction的值,转换为布尔值
            _disposeDirection: function() {
                if (this.setting.direction === 'vertical') {
                    return true;
                } else if (this.setting.direction === 'horizontal') {
                    return false;
                } else {
                    throw Error("direction参数错误.");
                }
            },

            // 初始化界面事件
            _initEvent: function() {
                var _this = this;

                // 鼠标单击导航菜单,调用动画函数
                $('.topHeader .menu-item').each(function(i) {
                    $(this).on('click', function() {
                        _this.s_index = i;
                        _this.scrollAnimate();
                        _this._setMenuActive();
                        return false;
                    })
                })

                $(window).on('scroll', function() {
                    _this._isReTopHeader();
                });
                $(window).on('scroll', _this._deBounce(function() {
                    _this._linkageScrolling();
                }, 500));

                /*支持CSS3动画的浏览器，绑定transitionend事件(即在动画结束后调用起回调函数)*/
                if (_prefix) {
                    _this.d_sectionWrap.on("transitionend webkitTransitionEnd oTransitionEnd otransitionend", function() {
                        _this.b_canScroll = true;
                    })
                }

                /*绑定鼠标滚轮事件*/
                this.element.on("mousewheel DOMMouseScroll", function(e) {
                    var delta = e.originalEvent.wheelDelta || -e.originalEvent.detail;
                    if (_this.b_canScroll && (!_this.s_direction || !_this.s_isScrolling)) {
                        if (delta < 0 && (_this.s_index < _this._getSectionCount()-1 && !_this.s_isLoop || _this.s_isLoop)) {
                            console.log('down');
                            _this.nextSlide();
                        } else if (delta > 0 && (_this.s_index && !_this.s_isLoop || _this.s_isLoop)) {
                            console.log('up');
                            _this.prevSlide();
                        }
                    };
                });


            },

            //滚到某一屏调用的回调函数
            _afterScrolling: function() {
                var _this = this;
                var index = this.s_index;
                $.isFunction(_this.s_afterLoad) && _this.s_afterLoad.call(this, index);
            },

            /**
             * 当浏览器滚动条滚动时,能知道滚动到哪个区域,这样可以设置菜单高亮和顶部菜单是否固定还是处于文档流
             */
            _linkageScrolling: function() {
                this.s_index = this._currentIndex();
                this._isReTopHeader();
                this._setMenuActive();
            },

            // 动态计算滚动是在哪个区间内
            _currentIndex: function() {
                var _this = this;
                var index = _this.b_tiggerSection.length - 1;
                var scrollSize = _this._dunamicScrollValue();
                // 遍历每个section的宽度区间的值
                $.each(_this.b_tiggerSection, function(i, data) {
                    var size = _this.b_tiggerSection[i];
                    var nextSize = _this.b_tiggerSection[i + 1];
                    /**
                     * 判断滚动条的top或者left是否在某个区间内,是则返回index值,就知道当前滚动在哪个屏
                     */
                    if (!nextSize || scrollSize >= size && scrollSize < nextSize) {
                        index = i;
                        return false;
                    }
                });
                return index;
            },

            // 顶部菜单是否移出文档流
            _isReTopHeader() {
                if (this._dunamicScrollValue() > this.d_sectionWrap.children().eq(1).position().top && this.s_isScrolling) {
                    this.d_sectionWrap.find('.topHeader').addClass('topHeader-fixed');
                };
                if (this._dunamicScrollValue() < this.d_section.eq(1).position().top && this.s_isScrolling) {
                    this.d_sectionWrap.find('.topHeader').removeClass('topHeader-fixed');
                }
            },

            // 动态计算window的滚动条的top或者left
            _dunamicScrollValue: function() {
                if (this.s_direction) {
                    return $(window).scrollTop();
                } else {
                    return $(window).scrollLeft();
                }
            },

            // 保存每个屏的top值或者left值,如果是竖屏则保存top值,如果是横屏则保存left值
            _dynamicPageSize: function() {
                var _this = this;
                _this.b_tiggerSection = [];
                /**
                 * bug: 当头部菜单处于文档流时,也就是在第一屏,这是获取的包含topHeader的top值
                 * 导致:从第一屏往下滚动时,会多滚出topHeader的高度那么多的位置
                 * 处理:初始就给fixed固定在第二屏最上面
                 */

                $.each(_this.d_section, function(i, data) {
                    if (_this.s_direction) {
                        _this.b_tiggerSection.push(_this.d_section.eq(i).position().top);
                    } else {
                        _this.b_tiggerSection.push(_this.d_section.eq(i).position().left);
                    }
                });
            },

            // 使用deBounce防抖来优化scroll事件的重复执行
            _deBounce: function(func, wait, immediate) {
                // 定时器变量
                var timeout;
                return function() {
                    // 每次触发 scroll handler 时先清除定时器
                    clearTimeout(timeout);
                    // 指定 xx ms 后触发真正想进行的操作 handler
                    timeout = setTimeout(func, wait);
                };
            }
        };
        return FullPageSlide;
    })();
    //让jQuery对象也能使用此方法，继承jQuery的对象
    $.fn.FullPageSlide = function(options) {
        //实现单例模式
        this.each(function() {
            var _this = $(this),
                instance = _this.data('FullPageSlide');
            if (!instance) {
                // _this.data('FullPageSlide', (instance = new FullPageSlide()));
                instance = new FullPageSlide(_this, options);
                _this.data('FullPageSlide', instance);
            }
            if ($.type(options) === 'string') {
                return instance[options]();
            }
        })
    };
    //对插件定义默认属性值
    $.fn.FullPageSlide.defaults = {
        navMenu: [], //接收一个数组,定义导航菜单的值,并会自动生成DOM
        author: '', //接收一个字符串,显示此项目名或者作者,只有在有navmenu的条件下才会生成
        active: 'active', //默认.active,用户可自定义active的类名
        index: 0, //默认从第1屏开始索引,索引值从0开始计算
        easing: 'ease', //默认为ease,动画效果[linear、ease、ease-in...]等等css3 transition的运动曲线
        duration: 500, //默认500,动画执行时间,单位ms
        direction: 'vertical', //默认垂直滚动,horizontal为水平方向,值[vertical, horizontal]
        isLoop: false, //默认false,是否循环切换滚动
        isScrolling: true, //默认true,是否全屏滚动,若为true则浏览器默认的滚动方式
        isKeyboard: true, //默认true,是否键盘控制切换
        isSlimscroll: false, //当内容超过可视区是否显示滚动条（需要引入slimscroll.js）
        afterLoad: '', //滚动到某一屏时触发的回调函数
        onLeave: '', //离开某一屏时触发的回调函数

    }

    //通过自定义HTML属性data-fullpageslide来调用插件
    $(function() {
        $('[data-fullpageslide]').FullPageSlide();
    });
})(jQuery); //闭包，传递jQuery对象
